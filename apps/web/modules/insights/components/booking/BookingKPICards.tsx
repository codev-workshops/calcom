"use client";

import { useLocale } from "@calcom/lib/hooks/useLocale";
import { trpc } from "@calcom/trpc/react";
import classNames from "@calcom/ui/classNames";
import { SkeletonText } from "@calcom/ui/components/skeleton";

import { valueFormatter } from "@calcom/features/insights/lib/valueFormatter";
import { useInsightsBookingParameters } from "@calcom/web/modules/insights/hooks/useInsightsBookingParameters";
import { ChartCard } from "../ChartCard";
import { KPICard } from "../KPICard";

export const BookingKPICards = () => {
  const { t } = useLocale();
  const insightsBookingParams = useInsightsBookingParameters();

  const { data, isSuccess, isPending, isError } = trpc.viewer.insights.bookingKPIStats.useQuery(
    insightsBookingParams,
    {
      staleTime: 180000,
      refetchOnWindowFocus: false,
      trpc: {
        context: { skipBatch: true },
      },
    }
  );

  const eventCategories: {
    title: string;
    index: "created" | "completed" | "rescheduled" | "cancelled";
  }[] = [
    {
      title: t("events_created"),
      index: "created",
    },
    {
      title: t("events_completed"),
      index: "completed",
    },
    {
      title: t("events_rescheduled"),
      index: "rescheduled",
    },
    {
      title: t("events_cancelled"),
      index: "cancelled",
    },
  ];

  const performanceCategories: {
    title: string;
    index: "rating" | "no_show" | "no_show_guest" | "csat";
  }[] = [
    {
      title: t("event_ratings"),
      index: "rating",
    },
    {
      title: t("event_no_show"),
      index: "no_show",
    },
    {
      title: t("event_no_show_guest"),
      index: "no_show_guest",
    },
    {
      title: t("csat_score"),
      index: "csat",
    },
  ];

  if (isPending) {
    return (
      <LoadingKPICards
        eventCategories={eventCategories}
        performanceCategories={performanceCategories}
        isPending={isPending}
        isError={isError}
      />
    );
  }

  if (!isSuccess || !data) return null;

  return (
    <div className="stack-y-4">
      <ChartCard title={t("events")} isPending={isPending} isError={isError}>
        <StatContainer>
          {eventCategories.map((item, index) => (
            <StatItem key={item.title} index={index}>
              <KPICard
                title={item.title}
                previousMetricData={data[item.index]}
                previousDateRange={data.previousRange}
              />
            </StatItem>
          ))}
        </StatContainer>
      </ChartCard>

      <ChartCard title={t("performance")} isPending={isPending} isError={isError}>
        <StatContainer>
          {performanceCategories.map((item, index) => (
            <StatItem key={item.title} index={index}>
              <KPICard
                title={item.title}
                previousMetricData={data[item.index]}
                previousDateRange={data.previousRange}
              />
            </StatItem>
          ))}
        </StatContainer>
      </ChartCard>
    </div>
  );
};

const LoadingKPICards = (props: {
  eventCategories: { title: string; index: string }[];
  performanceCategories: { title: string; index: string }[];
  isPending: boolean;
  isError: boolean;
}) => {
  const { eventCategories, performanceCategories, isPending, isError } = props;
  const { t } = useLocale();

  return (
    <div className="stack-y-4">
      <ChartCard title={t("events")} isPending={isPending} isError={isError}>
        <StatContainer>
          {eventCategories.map((item, index) => (
            <StatItem key={item.title} index={index}>
              <div>
                <SkeletonText className="mb-2 h-4 w-24" />
                <div className="items-baseline justify-start space-x-3 truncate">
                  <SkeletonText className="h-8 w-16" />
                </div>
                <div className="mt-4 justify-start space-x-2">
                  <SkeletonText className="h-4 w-20" />
                </div>
              </div>
            </StatItem>
          ))}
        </StatContainer>
      </ChartCard>

      <ChartCard title={t("performance")} isPending={isPending} isError={isError}>
        <StatContainer>
          {performanceCategories.map((item, index) => (
            <StatItem key={item.title} index={index}>
              <div>
                <SkeletonText className="mb-2 h-4 w-24" />
                <div className="items-baseline justify-start space-x-3 truncate">
                  <SkeletonText className="h-8 w-16" />
                </div>
                <div className="mt-4 justify-start space-x-2">
                  <SkeletonText className="h-4 w-20" />
                </div>
              </div>
            </StatItem>
          ))}
        </StatContainer>
      </ChartCard>
    </div>
  );
};

export const LeadTimeAndNoShowRateKPICards = () => {
  const { t } = useLocale();
  const insightsBookingParams = useInsightsBookingParameters();
  const queryOptions = {
    staleTime: 180000,
    refetchOnWindowFocus: false,
    trpc: {
      context: { skipBatch: true },
    },
  };

  const leadTimeQuery = trpc.viewer.insights.leadTimeStats.useQuery(insightsBookingParams, queryOptions);
  const noShowRateQuery = trpc.viewer.insights.noShowRateStats.useQuery(insightsBookingParams, queryOptions);

  const isPending = leadTimeQuery.isPending || noShowRateQuery.isPending;
  const isError = leadTimeQuery.isError || noShowRateQuery.isError;
  const leadTime = leadTimeQuery.data;
  const noShowRate = noShowRateQuery.data;

  const roundToOneDecimal = (value: number) => Math.round(value * 10) / 10;
  const formatDays = (value: number) =>
    t("insights_value_in_days", { value: valueFormatter(roundToOneDecimal(value)) });
  const formatPercentage = (value: number) => `${valueFormatter(roundToOneDecimal(value))}%`;

  const categories = [
    { title: t("average_lead_time"), metric: leadTime?.average, formatValue: formatDays },
    { title: t("median_lead_time"), metric: leadTime?.median, formatValue: formatDays },
    { title: t("host_no_show_rate"), metric: noShowRate?.host, formatValue: formatPercentage },
    { title: t("guest_no_show_rate"), metric: noShowRate?.guest, formatValue: formatPercentage },
  ];

  if (!isPending && (!leadTime || !noShowRate)) {
    return <ChartCard title={t("lead_time_and_no_show_rate")} isPending={isPending} isError={isError} />;
  }

  return (
    <ChartCard title={t("lead_time_and_no_show_rate")} isPending={isPending} isError={isError}>
      {!isPending && leadTime?.empty && noShowRate?.empty ? (
        <div className="text-default flex h-32 text-center">
          <p className="m-auto text-sm font-light">{t("insights_no_data_found_for_filter")}</p>
        </div>
      ) : (
        <StatContainer>
          {categories.map((item, index) => (
            <StatItem key={item.title} index={index}>
              {item.metric && leadTime && noShowRate ? (
                <KPICard
                  title={item.title}
                  previousMetricData={item.metric}
                  previousDateRange={index < 2 ? leadTime.previousRange : noShowRate.previousRange}
                  formatValue={item.formatValue}
                />
              ) : (
                <div>
                  <SkeletonText className="mb-2 h-4 w-24" />
                  <div className="items-baseline justify-start space-x-3 truncate">
                    <SkeletonText className="h-8 w-16" />
                  </div>
                  <div className="mt-4 justify-start space-x-2">
                    <SkeletonText className="h-4 w-20" />
                  </div>
                </div>
              )}
            </StatItem>
          ))}
        </StatContainer>
      )}
    </ChartCard>
  );
};

// StatContainer: wraps the grid
function StatContainer({ children }: { children: React.ReactNode }) {
  return <div className="group grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4">{children}</div>;
}

// StatItem: handles border logic
function StatItem({ index, children }: { index: number; children: React.ReactNode }) {
  return (
    <div
      className={classNames(
        "border-muted flex-1 p-4",
        index === 0 && "border-b sm:border-r md:border-b-0 md:border-r",
        index === 1 && "border-b sm:border-r-0 md:border-b-0 md:border-r",
        index === 2 && "border-b sm:border-b-0 sm:border-r md:border-b-0"
      )}>
      {children}
    </div>
  );
}
