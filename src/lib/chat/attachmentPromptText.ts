import type { PromptAttachment } from "@/server/queue/types";
import type { PromptAttachmentPart } from "@/types/message";

interface TextAttachmentInput {
	filename: string;
	textContent?: string;
}

export function formatTextAttachmentForPrompt({
	filename,
	textContent,
}: TextAttachmentInput): string | null {
	if (!textContent) return null;

	return [`Attached file: ${filename}`, "```", textContent, "```"].join("\n");
}

export function promptAttachmentToPromptParts(
	attachment: PromptAttachmentPart,
): Array<
	| { type: "text"; text: string }
	| { type: "file"; mime: string; url: string; filename: string }
> {
	if (attachment.kind === "text") {
		const text = formatTextAttachmentForPrompt(attachment);
		return text ? [{ type: "text", text }] : [];
	}

	if (!attachment.dataUrl) return [];
	return [
		{
			type: "file",
			mime: attachment.mime,
			url: attachment.dataUrl,
			filename: attachment.filename,
		},
	];
}

export function storedAttachmentToPromptParts(
	attachment: PromptAttachment,
): Array<
	| { type: "text"; text: string }
	| { type: "file"; mime: string; url: string; filename?: string }
> {
	if (attachment.kind === "text") {
		const text = formatTextAttachmentForPrompt(attachment);
		return text ? [{ type: "text", text }] : [];
	}

	return [
		{
			type: "file",
			mime: attachment.mime,
			url: attachment.dataUrl,
			filename: attachment.filename,
		},
	];
}
