import os
import re
import sys
from loguru import logger

def inline_charts(html_path: str, output_path: str = None):
    """
    将 HTML 中的 iframe图表 替换为内联代码。
    """
    if not output_path:
        output_path = html_path

    try:
        with open(html_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        logger.error(f"File not found: {html_path}")
        return

    # 1. 检查并添加 ECharts CDN (如果还没有)
    if "echarts.min.js" not in content:
        cdn_script = '<script src="https://cdn.jsdelivr.net/npm/echarts@5.4.3/dist/echarts.min.js"></script>\n'
        if "</head>" in content:
            content = content.replace("</head>", cdn_script + "</head>")
        else:
            content = cdn_script + content

    # 2. 查找所有 iframe
    # 假设格式: <iframe src="path/to/chart.html" ... ></iframe>
    # 正则提取 src
    # Pattern: <iframe[^>]*src=["']([^"']+)["'][^>]*>.*?</iframe>
    pattern = re.compile(r'<iframe[^>]*src=["\']([^"\']+)["\'][^>]*>.*?</iframe>', re.DOTALL)
    
    def replacer(match):
        src = match.group(1)
        # 解析路径: 假设 src 是相对于 html_path 的
        # 如果 html_path 是 assets/examples/demo.html, src 是 ../../reports/charts/xxx.html
        # 则真实路径是 assets/examples/../../reports/charts/xxx.html -> reports/charts/xxx.html
        
        base_dir = os.path.dirname(html_path)
        chart_path = os.path.normpath(os.path.join(base_dir, src))
        
        logger.info(f"Processing chart: {src} -> {chart_path}")
        
        if not os.path.exists(chart_path):
            logger.warning(f"Chart file not found: {chart_path}. Keeping iframe.")
            return match.group(0)
            
        try:
            with open(chart_path, 'r', encoding='utf-8') as f:
                chart_html = f.read()
            
            # 提取 div 和 script
            # Pyecharts div ID pattern: <div id="([a-f0-9]+)" ...>
            # Script pattern: <script>...var chart_([a-f0-9]+) = ...</script>
            
            # 正则提取 div
            div_match = re.search(r'<div[^>]*id=["\'][a-z0-9]+["\'][^>]*class=["\']chart-container["\'][^>]*></div>', chart_html)
            # 有时候 class 属性顺序不同或者没 class，更通用的提取
            # Pyecharts template: <div id="{chart_id}" style="width:{width}; height:{height};"></div>
            # 让我们提取 body 内的所有内容，剔除 CDN script
            
            # 正则提取 body 内容 (更宽松的正则)
            body_match = re.search(r'<body[^>]*>(.*?)</body>', chart_html, re.DOTALL | re.IGNORECASE)
            if body_match:
                body_content = body_match.group(1)
                # 移除 CDN 引用
                body_content = re.sub(r'<script[^>]*src=["\'].*?echarts\.min\.js["\'][^>]*></script>', '', body_content)
                return f'<div class="embedded-chart" style="margin: 20px 0;">{body_content}</div>'
            else:
                logger.warning(f"Could not parse body from {chart_path}")
                return match.group(0)

        except Exception as e:
            logger.error(f"Error processing {chart_path}: {e}")
            return match.group(0)

    new_content = pattern.sub(replacer, content)
    
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    logger.info(f"✅ Inlined charts into {output_path}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        inline_charts(sys.argv[1])
    else:
        # Default for testing
        inline_charts("assets/examples/demo_report.html")

