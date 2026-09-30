"""
終端命令列查詢介面 (CLI)
使用 Rich 套件呈現精美的全台天氣彩色表格
"""

import sys
import asyncio
import argparse

# 解決 Windows 終端 (cp950) 無法編碼 Unicode Emoji 的問題
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .client import CWAClient
from .config import ALL_CITIES

console = Console(force_terminal=True, legacy_windows=False)


async def query_weather(city_name: str = None):
    """非同步查詢並列印天氣資料"""
    client = CWAClient()
    
    with console.status("[bold cyan]正在向中央氣象署取得天氣預報...[/bold cyan]", spinner="dots"):
        response = await client.get_forecast(city_name=city_name)

    # 顯示資料狀態
    source_badge = "[green]● 氣象署即時資料 (LIVE)[/green]" if response.is_live else "[yellow]▲ 模擬資料 (MOCK)[/yellow]"
    console.print(Panel(
        f"[bold white]台灣天氣預報 (36小時)[/bold white] | 更新時間: {response.updated_at} | 來源: {source_badge}",
        style="blue"
    ))

    # 顯示即時警特報 (若有)
    if response.alerts:
        for alert in response.alerts:
            affected = "、".join(alert.affected_areas) if alert.affected_areas else "全台"
            console.print(Panel(
                f"[bold red]⚠️ {alert.headline}[/bold red]\n{alert.description}\n[dim]影響區域：{affected}[/dim]",
                title="[red]氣象特報警示[/red]",
                border_style="red"
            ))

    # 建立漂亮表格
    table = Table(title="全台縣市今明預報", show_header=True, header_style="bold magenta", expand=True)
    table.add_column("分區", justify="center", style="cyan", width=6)
    table.add_column("縣市", justify="center", style="bold white", width=8)
    table.add_column("時段 1 (今日白天/傍晚)", justify="left")
    table.add_column("時段 2 (今晚明晨)", justify="left")
    table.add_column("時段 3 (明日白天)", justify="left")

    for city in response.cities:
        p_strs = []
        for p in city.periods[:3]:
            # 依降雨機率變色
            pop_color = "bright_blue" if p.pop >= 40 else "dim"
            p_text = f"{p.icon} {p.weather}\n🌡️ {p.min_temp}°C ~ {p.max_temp}°C\n[{pop_color}]💧 降雨 {p.pop}%[/{pop_color}]"
            p_strs.append(p_text)

        while len(p_strs) < 3:
            p_strs.append("暫無資料")

        table.add_row(
            city.region,
            f"[bold yellow]{city.city_name}[/bold yellow]",
            p_strs[0],
            p_strs[1],
            p_strs[2]
        )

    console.print(table)


def main():
    """CLI 入口函數"""
    parser = argparse.ArgumentParser(description="台灣 36 小時天氣預報查詢工具")
    parser.add_argument("city", nargs="?", default=None, help="指定查詢縣市 (例: 臺北市、高雄市)")
    args = parser.parse_args()

    try:
        asyncio.run(query_weather(args.city))
    except KeyboardInterrupt:
        console.print("\n[yellow]已取消查詢。[/yellow]")
        sys.exit(0)


if __name__ == "__main__":
    main()
