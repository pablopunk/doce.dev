import {
	createPromptAttachmentPart,
	createTextPart,
	type MessagePart,
} from "@/types/message";

const HIDDEN_TEXT_ATTACHMENT_BLOCK =
	/Attached file: ([^\n]+)\n```\n([\s\S]*?)\n```/g;

export function expandHiddenTextAttachments(text: string): MessagePart[] {
	const parts: MessagePart[] = [];
	let lastIndex = 0;

	for (const match of text.matchAll(HIDDEN_TEXT_ATTACHMENT_BLOCK)) {
		const start = match.index ?? 0;
		const fullMatch = match[0];
		const filename = match[1]?.trim();
		const textContent = match[2] ?? "";

		const leadingText = text.slice(lastIndex, start).trim();
		if (leadingText) {
			parts.push(createTextPart(leadingText));
		}

		if (filename) {
			parts.push(
				createPromptAttachmentPart({
					filename,
					mime: "text/plain",
					kind: "text",
					textPreview: "Text file attached",
					textContent,
				}),
			);
		}

		lastIndex = start + fullMatch.length;
	}

	const trailingText = text.slice(lastIndex).trim();
	if (trailingText) {
		parts.push(createTextPart(trailingText));
	}

	return parts;
}
