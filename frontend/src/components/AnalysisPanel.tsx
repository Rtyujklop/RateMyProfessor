import { useMemo, useState } from "react";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

import { getProfessorHistory } from "../utils/api";
import type { AnalysisResponse, AnalysisHistoryEntry } from "../utils/types";

type AnalysisPanelProps = {
	analysis: AnalysisResponse;
};

const EST_TIME_ZONE = "America/New_York";

const TZ_SUFFIX_PATTERN = /(Z|[+-]\d{2}:?\d{2})$/i;

function formatDifference(delta: number): string {
	if (delta > 0) {
		return `+${delta.toFixed(2)}`;
	}

	return delta.toFixed(2);
}

function formatDateLabel(isoDate: string): string {
	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) {
		return "Unknown";
	}

	return date.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "2-digit",
		timeZone: EST_TIME_ZONE,
	});
}

function formatDateTimeLabel(isoDate: string): string {
	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) {
		return "Unknown";
	}

	return date.toLocaleString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
		timeZone: EST_TIME_ZONE,
	});
}

function getEasternDayKey(timestamp: number): string {
	const date = new Date(timestamp);
	if (Number.isNaN(date.getTime())) {
		return "invalid";
	}

	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: EST_TIME_ZONE,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});

	return formatter.format(date);
}

function formatDateFromTimestamp(timestamp: number): string {
	return formatDateLabel(new Date(timestamp).toISOString());
}

function formatDateTimeFromUnknown(value: unknown): string {
	if (typeof value === "number") {
		return formatDateTimeLabel(new Date(value).toISOString());
	}

	if (typeof value === "string") {
		return formatDateTimeLabel(value);
	}

	return "Unknown";
}

function formatTooltipValue(value: unknown): string {
	if (typeof value === "number") {
		return value.toFixed(2);
	}

	if (typeof value === "string") {
		const parsed = Number.parseFloat(value);
		if (!Number.isNaN(parsed)) {
			return parsed.toFixed(2);
		}
	}

	return "-";
}

function parseApiTimestampToMillis(rawValue: string): number {
	const trimmed = rawValue.trim();
	if (trimmed.length === 0) {
		return Number.NaN;
	}

	const normalized = trimmed.includes(" ")
		? trimmed.replace(" ", "T")
		: trimmed;

	const utcCandidate = TZ_SUFFIX_PATTERN.test(normalized)
		? normalized
		: `${normalized}Z`;

	const utcParsed = Date.parse(utcCandidate);
	if (!Number.isNaN(utcParsed)) {
		return utcParsed;
	}

	return Date.parse(normalized);
}

export function AnalysisPanel({ analysis }: AnalysisPanelProps) {
	const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);
	const [isLoadingHistory, setIsLoadingHistory] = useState(false);
	const [historyError, setHistoryError] = useState("");
	const [history, setHistory] = useState<AnalysisHistoryEntry[] | null>(null);

	const difference = analysis.sentimentScore - analysis.rmpRating;

	const chartData = useMemo(() => {
		const sortedHistory = [...(history ?? [])].sort(
			(left, right) =>
				new Date(left.createdAt).getTime() -
				new Date(right.createdAt).getTime(),
		);

		return sortedHistory.map((entry) => {
			const timestamp = parseApiTimestampToMillis(entry.createdAt);

			return {
				timestamp,
				rmpRating: entry.rmpRating,
				sentimentScore: entry.sentimentScore,
			};
		});
	}, [history]);

	const xAxisTicks = useMemo(() => {
		const firstTimestampByDate = new Map<string, number>();

		for (const point of chartData) {
			if (!Number.isFinite(point.timestamp)) {
				continue;
			}

			const key = getEasternDayKey(point.timestamp);
			if (!firstTimestampByDate.has(key)) {
				firstTimestampByDate.set(key, point.timestamp);
			}
		}

		return Array.from(firstTimestampByDate.values());
	}, [chartData]);

	const yAxisDomain = useMemo<[number, number]>(() => {
		if (chartData.length === 0) {
			return [0, 5];
		}

		let minValue = Number.POSITIVE_INFINITY;
		let maxValue = Number.NEGATIVE_INFINITY;

		for (const point of chartData) {
			minValue = Math.min(minValue, point.rmpRating, point.sentimentScore);
			maxValue = Math.max(maxValue, point.rmpRating, point.sentimentScore);
		}

		let domainMin = Math.floor(minValue);
		let domainMax = Math.ceil(maxValue);

		if (domainMin === domainMax) {
			domainMin -= 1;
			domainMax += 1;
		}

		domainMin = Math.max(0, domainMin);
		domainMax = Math.min(5, domainMax);

		if (domainMin >= domainMax) {
			return [0, 5];
		}

		return [domainMin, domainMax];
	}, [chartData]);

	const yAxisTicks = useMemo(() => {
		const ticks: number[] = [];
		for (let value = yAxisDomain[0]; value <= yAxisDomain[1]; value += 1) {
			ticks.push(value);
		}
		return ticks;
	}, [yAxisDomain]);

	async function handleViewHistory() {
		setIsHistoryExpanded((current) => !current);

		if (history || isLoadingHistory) {
			return;
		}

		setIsLoadingHistory(true);
		setHistoryError("");

		try {
			const response = await getProfessorHistory(analysis.professorId);
			setHistory(response.history ?? []);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Could not load rating history.";
			setHistoryError(message);
		} finally {
			setIsLoadingHistory(false);
		}
	}

	return (
		<section className="analysis-panel" aria-live="polite">
			<h2>{analysis.name}</h2>
			<div className="analysis-metrics">
				<div>
					<p className="metric-label">RateMyProfessor</p>
					<p className="metric-value">{analysis.rmpRating.toFixed(2)}</p>
				</div>
				<div>
					<p className="metric-label">Sentiment</p>
					<p className="metric-value">{analysis.sentimentScore.toFixed(2)}</p>
				</div>
				<div>
					<p className="metric-label">Difference</p>
					<p className="metric-value">{formatDifference(difference)}</p>
				</div>
			</div>

			<button
				type="button"
				className="history-toggle"
				onClick={handleViewHistory}
				aria-expanded={isHistoryExpanded}
			>
				<span
					className={`history-toggle-icon ${isHistoryExpanded ? "expanded" : ""}`}
					aria-hidden="true"
				>
					▾
				</span>
				View rating history
			</button>

			<div
				className={`history-expandable ${isHistoryExpanded ? "expanded" : ""}`}
			>
				<div className="history-panel-content">
					{isLoadingHistory ? (
						<div className="history-loading" role="status" aria-live="polite">
							<div className="spinner large" aria-hidden="true" />
						</div>
					) : historyError ? (
						<p className="error" role="alert">
							{historyError}
						</p>
					) : chartData.length > 0 ? (
						<div className="history-chart-wrap">
							<ResponsiveContainer width="100%" height={220}>
								<LineChart
									data={chartData}
									margin={{ top: 12, right: 12, left: 0, bottom: 0 }}
								>
									<CartesianGrid stroke="#dde2e8" strokeDasharray="3 3" />
									<XAxis
										type="number"
										dataKey="timestamp"
										domain={["dataMin", "dataMax"]}
										ticks={xAxisTicks}
										tickFormatter={(value: number) =>
											formatDateFromTimestamp(value)
										}
										tick={{ fill: "#697382", fontSize: 12 }}
									/>
									<YAxis
										domain={yAxisDomain}
										ticks={yAxisTicks}
										tick={{ fill: "#697382", fontSize: 12 }}
									/>
									<Tooltip
										labelFormatter={(value) => formatDateTimeFromUnknown(value)}
										formatter={(value) => formatTooltipValue(value)}
									/>
									<Legend />
									<Line
										type="linear"
										dataKey="rmpRating"
										name="RateMyProfessor"
										stroke="#1c232b"
										strokeWidth={2}
										dot={{ r: 3 }}
									/>
									<Line
										type="linear"
										dataKey="sentimentScore"
										name="Sentiment"
										stroke="#0f766e"
										strokeWidth={2}
										dot={{ r: 3 }}
									/>
								</LineChart>
							</ResponsiveContainer>
						</div>
					) : (
						<p className="muted">No rating history available yet.</p>
					)}
				</div>
			</div>
		</section>
	);
}
