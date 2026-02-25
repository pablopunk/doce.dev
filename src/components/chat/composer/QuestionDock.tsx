import { CircleHelp } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { PendingQuestionRequest } from "@/stores/useChatStore";

interface QuestionDockProps {
	request: PendingQuestionRequest;
	onSubmit: (answers: string[][]) => void;
	onReject: () => void;
}

export function QuestionDock({
	request,
	onSubmit,
	onReject,
}: QuestionDockProps) {
	const [index, setIndex] = useState(0);
	const [answers, setAnswers] = useState<string[][]>(
		request.questions.map(() => []),
	);
	const [customValues, setCustomValues] = useState<string[]>(
		request.questions.map(() => ""),
	);

	const question = request.questions[index];
	const isLast = index === request.questions.length - 1;
	const selected = answers[index] ?? [];

	const canContinue = useMemo(() => {
		const hasSelectedOption = selected.length > 0;
		const customValue = customValues[index]?.trim() ?? "";
		return hasSelectedOption || customValue.length > 0;
	}, [customValues, index, selected]);

	if (!question) {
		return null;
	}

	const setQuestionAnswers = (next: string[]) => {
		setAnswers((previous) => {
			const copy = [...previous];
			copy[index] = next;
			return copy;
		});
	};

	const toggleOption = (label: string) => {
		if (question.multiple) {
			setQuestionAnswers(
				selected.includes(label)
					? selected.filter((item) => item !== label)
					: [...selected, label],
			);
			return;
		}

		setQuestionAnswers([label]);
	};

	const updateCustom = (value: string) => {
		setCustomValues((previous) => {
			const copy = [...previous];
			copy[index] = value;
			return copy;
		});

		if (!value.trim()) {
			return;
		}

		if (question.multiple) {
			const withoutCustom = selected.filter(
				(item) => item !== customValues[index]?.trim(),
			);
			setQuestionAnswers([...withoutCustom, value.trim()]);
			return;
		}

		setQuestionAnswers([value.trim()]);
	};

	const goNext = () => {
		if (!isLast) {
			setIndex((current) =>
				Math.min(current + 1, request.questions.length - 1),
			);
			return;
		}

		onSubmit(
			request.questions.map((_, questionIndex) => {
				const value = customValues[questionIndex]?.trim();
				if (value && !(answers[questionIndex] ?? []).includes(value)) {
					return [...(answers[questionIndex] ?? []), value];
				}
				return answers[questionIndex] ?? [];
			}),
		);
	};

	return (
		<div className="border-t bg-muted/30 p-4">
			<div className="mx-auto max-w-3xl rounded-lg border bg-background p-4">
				<div className="mb-2 flex items-center gap-2 text-sm font-medium">
					<CircleHelp className="h-4 w-4 text-status-info" />
					{question.header || `Question ${index + 1}`}
				</div>
				<p className="mb-3 text-sm text-muted-foreground">
					{question.question}
				</p>

				<div className="space-y-2">
					{question.options.map((option) => {
						const picked = selected.includes(option.label);
						return (
							<button
								key={option.label}
								type="button"
								onClick={() => toggleOption(option.label)}
								className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
									picked ? "border-primary bg-primary/10" : "hover:bg-muted"
								}`}
							>
								<div className="font-medium">{option.label}</div>
								{option.description && (
									<div className="text-xs text-muted-foreground">
										{option.description}
									</div>
								)}
							</button>
						);
					})}

					{question.custom !== false && (
						<input
							type="text"
							value={customValues[index] ?? ""}
							onChange={(event) => updateCustom(event.currentTarget.value)}
							placeholder="Type your own answer"
							className="w-full rounded-md border bg-background px-3 py-2 text-sm"
						/>
					)}
				</div>

				<div className="mt-4 flex flex-wrap items-center justify-between gap-2">
					<div className="text-xs text-muted-foreground">
						{index + 1} of {request.questions.length}
					</div>
					<div className="flex gap-2">
						<Button variant="ghost" onClick={onReject}>
							Dismiss
						</Button>
						{index > 0 && (
							<Button
								variant="secondary"
								onClick={() => setIndex((current) => Math.max(0, current - 1))}
							>
								Back
							</Button>
						)}
						<Button onClick={goNext} disabled={!canContinue}>
							{isLast ? "Submit" : "Next"}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
