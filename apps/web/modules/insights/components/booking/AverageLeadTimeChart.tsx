"use client";

import { valueFormatter } from "@calcom/features/insights/lib/valueFormatter";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import type { RouterOutputs } from "@calcom/trpc/react";
import { trpc } from "@calcom/trpc/react";

import { useInsightsBookingParameters } from "@calcom/web/modules/insights/hooks/useInsightsBookingParameters";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartCard } from "../ChartCard";

const COLOR = {
  AVERAGE: "#3b82f6",
  MEDIAN: "#a855f7",
};

type AverageLeadTimeData = RouterOutputs["viewer"]["insights"]["averageLeadTime"][number];

const CustomTooltip = ({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    value: number;
    dataKey: string;
    name: string;
    color: string;
    payload: AverageLeadTimeData;
  }>;
}) => {
  const { t } = useLocale();
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="bg-default text-inverted border-subtle rounded-lg border p-3 shadow-lg">
      <p className="text-default font-medium">{payload[0].payload.formattedDateFull}</p>
      {payload.map((entry, index: number) => (
        <p key={index} style={{ color: entry.color }}>
          {entry.name}: {t("insights_value_in_days", { value: valueFormatter(entry.value) })}
        </p>
      ))}
    </div>
  );
};

export const AverageLeadTimeChart = () => {
  const { t } = useLocale();
  const insightsBookingParams = useInsightsBookingParameters();

  const { data, isSuccess, isPending, isError } = trpc.viewer.insights.averageLeadTime.useQuery(
    insightsBookingParams,
    {
      staleTime: 180000,
      refetchOnWindowFocus: false,
      trpc: {
        context: { skipBatch: true },
      },
    }
  );

  return (
    <ChartCard
      title={t("average_lead_time")}
      isPending={isPending}
      isError={isError}
      legend={[
        { label: t("average_lead_time"), color: COLOR.AVERAGE },
        { label: t("median_lead_time"), color: COLOR.MEDIAN },
      ]}>
      {isSuccess && data ? (
        data.every((item) => item.Count === 0) ? (
          <div className="text-default flex h-60 text-center">
            <p className="m-auto text-sm font-light">{t("insights_no_data_found_for_filter")}</p>
          </div>
        ) : (
          <div className="mt-4 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 30, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="Month" className="text-xs" axisLine={false} tickLine={false} />
                <YAxis
                  className="text-xs opacity-50"
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={valueFormatter}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="linear"
                  dataKey="Average"
                  name={t("average_lead_time")}
                  stroke={COLOR.AVERAGE}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  animationDuration={1000}
                />
                <Line
                  type="linear"
                  dataKey="Median"
                  name={t("median_lead_time")}
                  stroke={COLOR.MEDIAN}
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  animationDuration={1000}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      ) : null}
    </ChartCard>
  );
};
