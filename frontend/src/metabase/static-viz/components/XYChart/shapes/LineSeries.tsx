import React from "react";
import { Group } from "@visx/group";
import { LinePath } from "@visx/shape";
import { PositionScale } from "@visx/shape/lib/types";
import { getY } from "metabase/static-viz/components/XYChart/utils";

import type {
  Series,
  SeriesDatum,
} from "metabase/static-viz/components/XYChart/types";

interface LineSeriesProps {
  series: Series[];
  yScaleLeft: PositionScale | null;
  yScaleRight: PositionScale | null;
  xAccessor: (datum: SeriesDatum) => number;
}

export const LineSeries = ({
  series: multipleSeries,
  yScaleLeft,
  yScaleRight,
  xAccessor,
}: LineSeriesProps) => {
  return (
    <Group>
      {multipleSeries.map((series, seriesIndex) => {
        const yScale =
          series.yAxisPosition === "left" ? yScaleLeft : yScaleRight;
        if (!yScale) {
          return null;
        }

        const yAccessor = (datum: SeriesDatum) => yScale(getY(datum)) ?? 0;
        return (
          <>
            <LinePath
              key={series.name}
              data={series.data}
              x={xAccessor}
              y={yAccessor}
              stroke={series.color}
              strokeWidth={2}
            />
            {series.data.map((datum, dataIndex) => {
              return (
                <circle
                  key={`${seriesIndex}-${dataIndex}`}
                  r={2}
                  fill="white"
                  stroke={series.color}
                  strokeWidth={1.5}
                  cx={xAccessor(datum)}
                  cy={yAccessor(datum)}
                />
              );
            })}
          </>
        );
      })}
    </Group>
  );
};
