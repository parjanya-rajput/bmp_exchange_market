import {
  ColorType,
  createChart,
  CrosshairMode,
  ISeriesApi,
  UTCTimestamp,
} from "lightweight-charts";

export class ChartManager {
  private candleSeries: ISeriesApi<"Candlestick">;
  private lastCandle: any = null;
  private chart: ReturnType<typeof createChart>;

  constructor(
    ref: HTMLElement,
    initialData: any[],
    layout: { background: string; color: string }
  ) {
    const chart = createChart(ref, {
      autoSize: true,
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        visible: true,
        borderVisible: true,
      },
      layout: {
        background: {
          type: ColorType.Solid,
          color: layout.background,
        },
        textColor: layout.color,
      },
      grid: {
        horzLines: { visible: false },
        vertLines: { visible: false },
      },
    });

    this.chart = chart;
    this.candleSeries = chart.addCandlestickSeries();

    this.candleSeries.setData(
      initialData.map((data) => ({
        ...data,
        time: Math.floor(
          new Date(data.timestamp).getTime() / 1000
        ) as UTCTimestamp,
      }))
    );
  }

  public update(candle: any) {
    this.lastCandle = candle;
    this.candleSeries.update({
      ...candle,
      time: Math.floor(
        new Date(candle.timestamp).getTime() / 1000
      ) as UTCTimestamp,
    });
  }

  public destroy() {
    this.chart.remove();
  }
}
