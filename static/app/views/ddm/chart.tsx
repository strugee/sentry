import {forwardRef, useCallback, useEffect, useMemo, useRef} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import * as echarts from 'echarts/core';
import {CanvasRenderer} from 'echarts/renderers';

import {updateDateTime} from 'sentry/actionCreators/pageFilters';
import {transformToAreaSeries} from 'sentry/components/charts/areaChart';
import {transformToBarSeries} from 'sentry/components/charts/barChart';
import BaseChart, {BaseChartProps} from 'sentry/components/charts/baseChart';
import {transformToLineSeries} from 'sentry/components/charts/lineChart';
import ScatterSeries from 'sentry/components/charts/series/scatterSeries';
import {DateTimeObject} from 'sentry/components/charts/utils';
import {ReactEchartsRef} from 'sentry/types/echarts';
import mergeRefs from 'sentry/utils/mergeRefs';
import {
  formatMetricsUsingUnitAndOp,
  isCumulativeOp,
  MetricDisplayType,
} from 'sentry/utils/metrics';
import useRouter from 'sentry/utils/useRouter';
import {DDM_CHART_GROUP} from 'sentry/views/ddm/constants';
import {FocusArea, useFocusArea} from 'sentry/views/ddm/focusArea';

import {getFormatter} from '../../components/charts/components/tooltip';

import {useSampleHandlers} from './useSampleHandlers';
import {Sample, ScatterSeries as ScatterSeriesType, Series} from './widget';

type ChartProps = {
  displayType: MetricDisplayType;
  focusArea: FocusArea | null;
  series: Series[];
  widgetIndex: number;
  addFocusArea?: (area: FocusArea) => void;
  height?: number;
  onSampleClick?: SampleCallback;
  onSampleMouseOut?: (sample?: Sample) => void;
  onSampleMouseOver?: SampleCallback;
  operation?: string;
  removeFocusArea?: () => void;
  sampleSeries?: ScatterSeriesType[];
};

type SampleCallback = (sample: Sample) => void;

// We need to enable canvas renderer for echarts before we use it here.
// Once we use it in more places, this should probably move to a more global place
// But for now we keep it here to not invluence the bundle size of the main chunks.
echarts.use(CanvasRenderer);

export const MetricChart = forwardRef<ReactEchartsRef, ChartProps>(
  (
    {
      series,
      displayType,
      operation,
      widgetIndex,
      addFocusArea,
      focusArea,
      removeFocusArea,
      height,
      sampleSeries,
      onSampleClick,
      onSampleMouseOut,
      onSampleMouseOver,
    },
    forwardedRef
  ) => {
    const router = useRouter();
    const chartRef = useRef<ReactEchartsRef>(null);

    const handleZoom = useCallback(
      (range: DateTimeObject) => {
        Sentry.metrics.increment('ddm.enhance.zoom');
        updateDateTime(range, router, {save: true});
      },
      [router]
    );

    const focusAreaBrush = useFocusArea(
      chartRef,
      focusArea,
      {
        widgetIndex,
        isDisabled: !addFocusArea || !removeFocusArea || !handleZoom,
        useFullYAxis: isCumulativeOp(operation),
      },
      addFocusArea,
      removeFocusArea,
      handleZoom
    );

    useEffect(() => {
      const echartsInstance = chartRef?.current?.getEchartsInstance();
      if (echartsInstance && !echartsInstance.group) {
        echartsInstance.group = DDM_CHART_GROUP;
      }
    });

    const unit = series[0]?.unit;

    const seriesToShow = useMemo(() => {
      return series
        .filter(s => !s.hidden)
        .map(s => ({...s, silent: displayType === MetricDisplayType.BAR}));
    }, [series, displayType]);

    const {
      handleSampleClick,
      handleSampleMouseOut,
      handleSampleMouseOver,
      handleSampleHighlight,
    } = useSampleHandlers({
      numOfTimeseries: seriesToShow.length,
      sampleSeries,
      onClick: onSampleClick,
      onMouseOut: onSampleMouseOut,
      onMouseOver: onSampleMouseOver,
    });

    // TODO(ddm): This assumes that all series have the same bucket size
    const bucketSize = seriesToShow[0]?.data[1]?.name - seriesToShow[0]?.data[0]?.name;
    const isSubMinuteBucket = bucketSize < 60_000;
    const seriesLength = seriesToShow[0]?.data.length;
    const displayFogOfWar = isCumulativeOp(operation);

    const chartProps = useMemo(() => {
      const sampleFormatters = {
        isGroupedByDate: true,
        addSecondsToTimeFormat: isSubMinuteBucket,
        limit: 1,
        valueFormatter: (value: number) =>
          formatMetricsUsingUnitAndOp(value, unit, operation),
      };

      const timeseriesFormatters = {
        valueFormatter: (value: number) =>
          formatMetricsUsingUnitAndOp(value, unit, operation),
        isGroupedByDate: true,
        bucketSize,
        showTimeInTooltip: true,
        addSecondsToTimeFormat: isSubMinuteBucket,
        limit: 10,
      };

      const heightOptions = height ? {height} : {autoHeightResize: true};

      return {
        ...heightOptions,
        ...focusAreaBrush.options,

        forwardedRef: mergeRefs([forwardedRef, chartRef]),
        series: seriesToShow,
        renderer: seriesToShow.length > 20 ? ('canvas' as const) : ('svg' as const),
        isGroupedByDate: true,
        colors: seriesToShow.map(s => s.color),
        grid: {top: 5, bottom: 0, left: 0, right: 0},
        onMouseOver: handleSampleMouseOver,
        onMouseOut: handleSampleMouseOut,
        onClick: handleSampleClick,
        // onHighlight: handleSampleHighlight,

        tooltip: {
          formatter: (params, asyncTicket) => {
            if (focusAreaBrush.isDrawingRef.current) {
              return '';
            }
            const hoveredEchartElement = Array.from(
              document.querySelectorAll(':hover')
            ).find(element => {
              return element.classList.contains('echarts-for-react');
            });

            if (params.seriesType === 'scatter') {
              return getFormatter(sampleFormatters)(params, asyncTicket);
            }
            if (hoveredEchartElement === chartRef?.current?.ele) {
              return getFormatter(timeseriesFormatters)(params, asyncTicket);
            }
            return '';
          },
        },
        yAxis: {
          // used to find and convert datapoint to pixel position
          id: 'yAxis',
          axisLabel: {
            formatter: (value: number) => {
              return formatMetricsUsingUnitAndOp(value, unit, operation);
            },
          },
        },
        xAxis: {
          // used to find and convert datapoint to pixel position
          id: 'xAxis',
          axisPointer: {
            snap: true,
          },
        },
      };
    }, [
      bucketSize,
      focusAreaBrush.options,
      focusAreaBrush.isDrawingRef,
      forwardedRef,
      isSubMinuteBucket,
      operation,
      seriesToShow,
      unit,
      height,
      handleSampleClick,
      handleSampleMouseOut,
      handleSampleMouseOver,
    ]);

    return (
      <ChartWrapper>
        {focusAreaBrush.overlay}
        <CombinedChart
          {...chartProps}
          displayType={displayType}
          scatterSeries={sampleSeries}
        />
        {displayFogOfWar && (
          <FogOfWar bucketSize={bucketSize} seriesLength={seriesLength} />
        )}
      </ChartWrapper>
    );
  }
);

type CombinedChartProps = BaseChartProps & {
  displayType: MetricDisplayType;
  series: Series[];
  scatterSeries?: ScatterSeriesType[];
};

function CombinedChart({
  displayType,
  series,
  scatterSeries = [],
  ...chartProps
}: CombinedChartProps) {
  const combinedSeries = useMemo(() => {
    if (displayType === MetricDisplayType.LINE) {
      return [
        ...transformToLineSeries({series}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
      ];
    }

    if (displayType === MetricDisplayType.BAR) {
      return [
        ...transformToBarSeries({series, stacked: true, animation: false}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
      ];
    }

    if (displayType === MetricDisplayType.AREA) {
      return [
        ...transformToAreaSeries({series, stacked: true, colors: chartProps.colors}),
        ...transformToScatterSeries({series: scatterSeries, displayType}),
      ];
    }

    return [];
  }, [displayType, scatterSeries, series, chartProps.colors]);

  return <BaseChart {...chartProps} series={combinedSeries} />;
}

function transformToScatterSeries({
  series,
  displayType,
}: {
  displayType: MetricDisplayType;
  series: Series[];
}) {
  return series.map(({seriesName, data: seriesData, ...options}) => {
    if (displayType === MetricDisplayType.BAR) {
      return ScatterSeries({
        ...options,
        name: seriesName,
        data: seriesData?.map(({value, name}) => ({value: [name, value]})),
      });
    }

    return ScatterSeries({
      ...options,
      name: seriesName,
      data: seriesData?.map(({value, name}) => [name, value]),
      animation: false,
    });
  });
}

function FogOfWar({
  bucketSize,
  seriesLength,
}: {
  bucketSize?: number;
  seriesLength?: number;
}) {
  if (!bucketSize || !seriesLength) {
    return null;
  }

  const widthFactor = getWidthFactor(bucketSize);
  const fogOfWarWidth = widthFactor * bucketSize + 30_000;

  const seriesWidth = bucketSize * seriesLength;

  // If either of these are undefiend, NaN or 0 the result will be invalid
  if (!fogOfWarWidth || !seriesWidth) {
    return null;
  }

  const width = (fogOfWarWidth / seriesWidth) * 100;

  return <FogOfWarOverlay width={width ?? 0} />;
}

function getWidthFactor(bucketSize: number) {
  // In general, fog of war should cover the last bucket
  if (bucketSize > 30 * 60_000) {
    return 1;
  }

  // for 10s timeframe we want to show a fog of war that spans last 10 buckets
  // because on average, we are missing last 90 seconds of data
  if (bucketSize <= 10_000) {
    return 10;
  }

  // For smaller time frames we want to show a wider fog of war
  return 2;
}

const ChartWrapper = styled('div')`
  position: relative;
  height: 100%;
`;

const FogOfWarOverlay = styled('div')<{width?: number}>`
  height: calc(100% - 29px);
  width: ${p => p.width}%;
  position: absolute;
  right: 0px;
  top: 5px;
  pointer-events: none;
  background: linear-gradient(
    90deg,
    ${p => p.theme.background}00 0%,
    ${p => p.theme.background}FF 70%,
    ${p => p.theme.background}FF 100%
  );
`;
