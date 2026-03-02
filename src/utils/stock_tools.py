from datetime import datetime, timedelta
from typing import List, Dict, Optional
import akshare as ak
import yfinance as yf
import pandas as pd
import re
import sqlite3
import json
import requests as _requests
from requests.exceptions import RequestException
from loguru import logger
from utils.database_manager import DatabaseManager


class StockAPIDirect:
    """金融数据直接 HTTP 调用 —— 作为 akshare 的多层级降级方案。
    
    包含：
    1. EastMoney (东方财富)
    2. Tencent (腾讯财经)
    
    均使用 requests 直连，无需 API Key，增加浏览器 Headers 以应对 GitHub Actions 等环境的屏蔽。
    """
    
    EM_KLINE_URL = "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    EM_LIST_URL = "https://push2.eastmoney.com/api/qt/clist/get"
    EM_UT = "fa5fd1943c7b386f172d6893dbfba10b"
    
    TENCENT_KLINE_URL = "http://web.ifzq.gtimg.cn/appstock/app/fqkline/get"
    
    DEFAULT_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://quote.eastmoney.com/center/gridlist.html"
    }

    @staticmethod
    def _get_em_secid(ticker: str) -> str:
        if len(ticker) == 5:
            return f"116.{ticker}"
        if ticker.startswith(('6', '9')):
            return f"1.{ticker}"
        return f"0.{ticker}"
    
    @staticmethod
    def _get_tencent_symbol(ticker: str) -> str:
        if len(ticker) == 5:
            return f"hk{ticker}"
        if ticker.startswith(('6', '9')):
            return f"sh{ticker}"
        return f"sz{ticker}"

    @classmethod
    def fetch_kline_eastmoney(cls, ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
        """从东方财富获取 K 线数据 (YYYYMMDD)"""
        params = {
            'secid': cls._get_em_secid(ticker),
            'fields1': 'f1,f2,f3,f4,f5,f6',
            'fields2': 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
            'klt': '101', 'fqt': '1', 'beg': start_date, 'end': end_date,
            'lmt': '1000', 'ut': cls.EM_UT,
        }
        resp = _requests.get(cls.EM_KLINE_URL, params=params, headers=cls.DEFAULT_HEADERS, timeout=12)
        resp.raise_for_status()
        data = resp.json().get('data')
        if not data or not data.get('klines'):
            return pd.DataFrame()
        
        rows = [k.split(',') for k in data['klines']]
        df = pd.DataFrame(rows, columns=['日期', '开盘', '收盘', '最高', '最低', '成交量', '成交额', '振幅', '涨跌幅', '涨跌额', '换手率'])
        for col in ['开盘', '收盘', '最高', '最低', '成交量', '涨跌幅']:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        return df

    @classmethod
    def fetch_kline_tencent(cls, ticker: str, start_date: str, end_date: str) -> pd.DataFrame:
        """从腾讯财经获取 K 线数据 (YYYY-MM-DD)"""
        symbol = cls._get_tencent_symbol(ticker)
        params = {
            '_var': 'kline_day',
            'param': f"{symbol},day,{start_date},{end_date},640,qfq"
        }
        resp = _requests.get(cls.TENCENT_KLINE_URL, params=params, headers=cls.DEFAULT_HEADERS, timeout=12)
        resp.raise_for_status()
        
        content = resp.text.replace('kline_day=', '')
        data = json.loads(content)
        
        symbol_data = data.get('data', {}).get(symbol, {})
        klines = symbol_data.get('qfqday', symbol_data.get('day', []))
        
        if not klines:
            return pd.DataFrame()
        
        # 腾讯 K 线格式: [日期, 开盘, 收盘, 最高, 最低, 成交量, ...]
        df = pd.DataFrame(klines)
        df = df.iloc[:, :6]
        df.columns = ['日期', '开盘', '收盘', '最高', '最低', '成交量']
        
        # 补全 change_pct (腾讯不直接提供历史涨跌幅)
        df['收盘'] = pd.to_numeric(df['收盘'])
        df['涨跌幅'] = df['收盘'].pct_change() * 100
        df['涨跌幅'] = df['涨跌幅'].fillna(0)
        
        return df

    @classmethod
    def fetch_stock_list_em(cls, market: str = 'a') -> pd.DataFrame:
        """从东方财富获取股票列表"""
        fs = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23' if market == 'a' else 'm:128+t:3,m:128+t:4,m:128+t:1,m:128+t:2'
        all_items = []
        page = 1
        while True:
            params = {
                'pn': str(page), 'pz': '5000', 'po': '1', 'np': '1',
                'fltt': '2', 'invt': '2', 'fid': 'f12',
                'fs': fs, 'fields': 'f12,f14', 'ut': cls.EM_UT,
            }
            resp = _requests.get(cls.EM_LIST_URL, params=params, headers=cls.DEFAULT_HEADERS, timeout=15)
            resp.raise_for_status()
            data = resp.json().get('data', {})
            diff = data.get('diff', [])
            if not diff: break
            for item in diff:
                all_items.append({'code': item.get('f12', ''), 'name': item.get('f14', '')})
            if page * 5000 >= data.get('total', 0): break
            page += 1
        return pd.DataFrame(all_items)


class StockTools:
    """金融分析股票工具 - 结合高性能数据库缓存与增量更新"""
    
    def __init__(self, db: DatabaseManager, auto_update: bool = True):
        """
        初始化股票工具
        
        Args:
            db: 数据库管理器
            auto_update: 是否在列表为空时自动更新，默认 True
        """
        self.db = db
        if auto_update:
            self._check_and_update_stock_list()

    def _check_and_update_stock_list(self, force: bool = False):
        """检查并更新股票列表。仅在列表为空或 force=True 时从网络拉取。"""
        # 直接查询表中记录数
        cursor = self.db.conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM stock_list")
        count = cursor.fetchone()[0]
        
        if count > 0 and not force:
            logger.info(f"ℹ️ Stock list already cached ({count} stocks)")
            return
        
        logger.info("📡 Updating A-share and HK-share stock list...")
        
        df_combined = None
        
        # === 主路径: akshare ===
        try:
            df_a = ak.stock_zh_a_spot_em()
            df_a = df_a[['代码', '名称']].copy()
            df_a.columns = ['code', 'name']
            
            df_hk = ak.stock_hk_spot_em()
            df_hk = df_hk[['代码', '名称']].copy()
            df_hk.columns = ['code', 'name']
            
            df_combined = pd.concat([df_a, df_hk], ignore_index=True)
            logger.info(f"✅ akshare: fetched {len(df_combined)} stocks.")
        except Exception as e:
            logger.warning(f"⚠️ akshare stock list failed: {e}. Trying EastMoney direct...")
        
        if df_combined is None or df_combined.empty:
            try:
                df_a = StockAPIDirect.fetch_stock_list_em('a')
                df_hk = StockAPIDirect.fetch_stock_list_em('hk')
                df_combined = pd.concat([df_a, df_hk], ignore_index=True)
                logger.info(f"✅ EastMoney direct: fetched {len(df_combined)} stocks.")
            except Exception as e2:
                logger.error(f"❌ All stock list sources failed. akshare + EastMoney: {e2}")
                return
        
        if df_combined is not None and not df_combined.empty:
            self.db.save_stock_list(df_combined)
            logger.info(f"✅ Cached {len(df_combined)} stocks to database.")


    def search_ticker(self, query: str, limit: int = 5) -> List[Dict]:
        """
        模糊搜索 A 股股票代码或名称，支持常见缩写。
        """
        # 清洗后缀 (如 CATL.SZ -> CATL, 000001.SZ -> 000001)
        clean_query = re.sub(r'\.(SZ|SH|HK|US)$', '', query, flags=re.IGNORECASE)
        
        # 常见缩写映射
        aliases = {
            "CATL": "宁德时代",
            "BYD": "比亚迪",
            "TSLA": "特斯拉",
            "Moutai": "贵州茅台",
            "Tencent": "腾讯",
            "Alibaba": "阿里巴巴",
            "Meituan": "美团",
        }
        
        search_query = aliases.get(clean_query.upper(), clean_query)
        
        # Robustness: if regex-like ticker code is embedded in query (e.g. "300364 中文在线"), try to extract it
        if not search_query.isdigit():
             # Extract explicit 5-6 digit codes
             match = re.search(r'\b(\d{5,6})\b', clean_query)
             if match:
                 search_query = match.group(1)

        res = self.db.search_stock(search_query, limit)
        if not res and search_query.isalpha():
            # Robustness: mock search hit for alphabetic US tickers
            return [{"code": search_query.upper(), "name": search_query.upper()}]
        return res

    def get_stock_price(
        self,
        ticker: str,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        force_sync: bool = False,
    ) -> pd.DataFrame:
        """
        获取指定股票的历史价格数据。优先从本地缓存读取，缺失时自动从网络补齐。
        
        Args:
            ticker: 股票代码，如 "600519"（贵州茅台）或 "000001"（平安银行）。
            start_date: 开始日期，格式 "YYYY-MM-DD"。默认为 90 天前。
            end_date: 结束日期，格式 "YYYY-MM-DD"。默认为今天。
        
        Returns:
            包含 date, open, close, high, low, volume, change_pct 列的 DataFrame。
        """
        now = datetime.now()
        if not end_date:
            end_date = now.strftime('%Y-%m-%d')
        if not start_date:
            start_date = (now - timedelta(days=90)).strftime('%Y-%m-%d')

        df_db = self.db.get_stock_prices(ticker, start_date, end_date)
        
        need_update = False
        if df_db.empty:
            need_update = True
        else:
            db_latest = pd.to_datetime(df_db['date'].max())
            req_latest = pd.to_datetime(end_date)
            if (req_latest - db_latest).days > 2:
                need_update = True

        if force_sync:
            need_update = True

        if need_update:
            logger.info(f"📡 Data stale or missing for {ticker}, syncing from network...")
            
            is_us_stock = bool(re.search(r'[a-zA-Z]', ticker)) and not bool(re.search(r'\d{5,6}', ticker))
            
            if is_us_stock:
                clean_ticker = ticker.upper()
            else:
                # 清洗 ticker，确保只包含数字（Akshare A 股接口通常只需要数字代码）
                clean_ticker = "".join(filter(str.isdigit, ticker))
                if not clean_ticker:
                    logger.warning(f"⚠️ Unsupported ticker format: {ticker}")
                    return df_db

            try:
                s_fmt = start_date.replace("-", "")
                e_fmt = end_date.replace("-", "")
                
                df_remote = None
                
                def fetch_data_akshare():
                    """主路径: akshare"""
                    if is_us_stock:
                        return _fetch_data_yfinance()
                    if len(clean_ticker) == 5:
                        return ak.stock_hk_hist(
                            symbol=clean_ticker, period="daily",
                            start_date=s_fmt, end_date=e_fmt,
                            adjust="qfq"
                        )
                    else:
                        return ak.stock_zh_a_hist(
                            symbol=clean_ticker, period="daily",
                            start_date=s_fmt, end_date=e_fmt,
                            adjust="qfq"
                        )

                def _fetch_data_yfinance():
                    """美股路径: yfinance"""
                    yf_ticker = yf.Ticker(clean_ticker)
                    end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
                    df_us = yf_ticker.history(start=start_date, end=end_dt.strftime("%Y-%m-%d"))
                    if df_us.empty:
                        return pd.DataFrame()
                    
                    df_us = df_us.reset_index()
                    date_col = 'Date' if 'Date' in df_us.columns else df_us.columns[0]
                    df_us = df_us.rename(columns={
                        'Open': 'open', 'Close': 'close',
                        'High': 'high', 'Low': 'low', 'Volume': 'volume'
                    })
                    
                    if pd.api.types.is_datetime64_any_dtype(df_us[date_col]):
                        df_us['date'] = df_us[date_col].dt.strftime('%Y-%m-%d')
                    else:
                        df_us['date'] = pd.to_datetime(df_us[date_col]).dt.strftime('%Y-%m-%d')
                        
                    df_us['change_pct'] = df_us['close'].pct_change() * 100
                    df_us['change_pct'] = df_us['change_pct'].fillna(0)
                    
                    return df_us[['date', 'open', 'close', 'high', 'low', 'volume', 'change_pct']]

                def fetch_data_eastmoney():
                    """降级路径 1: 东方财富直接 HTTP"""
                    logger.info(f"📡 Trying EastMoney direct for {clean_ticker}...")
                    return StockAPIDirect.fetch_kline_eastmoney(clean_ticker, s_fmt, e_fmt)
                
                def fetch_data_tencent():
                    """降级路径 2: 腾讯财经直接 HTTP"""
                    logger.info(f"📡 Trying Tencent direct for {clean_ticker}...")
                    # 腾讯日期格式支持 YYYY-MM-DD
                    return StockAPIDirect.fetch_kline_tencent(clean_ticker, start_date, end_date)

                # === 多源尝试策略 ( akshare -> EastMoney -> Tencent ) ===
                try:
                    df_remote = fetch_data_akshare()
                except Exception as e:
                    logger.warning(f"⚠️ akshare failed for {clean_ticker}: {e}")
                    if is_us_stock: raise e
                    
                    # 尝试东方财富
                    try:
                        df_remote = fetch_data_eastmoney()
                    except Exception as e_em:
                        logger.warning(f"⚠️ EastMoney direct also failed for {clean_ticker}: {e_em}")
                        
                        # 尝试腾讯财经 (最后一道防线)
                        try:
                            df_remote = fetch_data_tencent()
                        except Exception as e_tx:
                            logger.error(f"❌ All sources (akshare/EM/Tencent) failed for {clean_ticker}")
                            raise e  # 抛出最初的错误
                
                if df_remote is not None and not df_remote.empty:
                    if not is_us_stock:
                        df_remote = df_remote.rename(columns={
                            '日期': 'date', '开盘': 'open', '收盘': 'close',
                            '最高': 'high', '最低': 'low', '成交量': 'volume',
                            '涨跌幅': 'change_pct'
                        })
                    # 确保日期格式正确
                    df_remote['date'] = pd.to_datetime(df_remote['date']).dt.strftime('%Y-%m-%d')
                    
                    # 只有在获取到有意义的数据时才保存
                    self.db.save_stock_prices(clean_ticker, df_remote) # 保存时使用清洗后的 clean_ticker
                    
                    # 重新查询数据库返回结果，保证一致性
                    return self.db.get_stock_prices(clean_ticker, start_date, end_date)
                else:
                    logger.warning(f"⚠️ Akshare returned empty data for {clean_ticker}")
                    
            except KeyError as e:
                # Akshare 有时在某些股票无数据时会抛出 KeyError
                logger.warning(f"⚠️ Akshare data missing for {clean_ticker}: {e}")
            except (RequestException, ConnectionError) as e:
                logger.error(f"❌ Network error during Akshare sync for {clean_ticker}: {e}")
            except sqlite3.Error as e:
                logger.error(f"❌ Database error during Akshare sync for {clean_ticker}: {e}")
            except Exception as e:
                logger.error(f"❌ Unexpected error during Akshare sync for {clean_ticker}: {e}")
        
        return df_db


def get_stock_analysis(ticker: str, db: DatabaseManager) -> str:
    """
    生成指定股票的分析摘要报告。
    
    Args:
        ticker: 股票代码
        db: 数据库管理器实例
    
    Returns:
        Markdown 格式的分析报告，包含价格走势和关键指标。
    """
    tools = StockTools(db)
    df = tools.get_stock_price(ticker)
    
    if df.empty:
        return f"❌ 未能获取 {ticker} 的股价数据。"
    
    latest = df.iloc[-1]
    change = ((latest['close'] - df.iloc[0]['close']) / df.iloc[0]['close']) * 100
    
    report = [
        f"## 📊 {ticker} 分析报告",
        f"- **查询时段**: {df.iloc[0]['date']} -> {latest['date']}",
        f"- **当前价**: ¥{latest['close']:.2f}",
        f"- **时段涨跌**: {change:+.2f}%",
        f"- **最高/最低**: ¥{df['high'].max():.2f} / ¥{df['low'].min():.2f}",
        "\n### 最近交易概览",
        "```",
        df.tail(5)[['date', 'close', 'change_pct', 'volume']].to_string(index=False),
        "```"
    ]
    return "\n".join(report)
