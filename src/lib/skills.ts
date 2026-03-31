const REQUIRED_GLOBAL_SKILL_NAMES = ["find-skills"] as const;

export type RequiredGlobalSkillName =
	(typeof REQUIRED_GLOBAL_SKILL_NAMES)[number];

export function isRequiredGlobalSkill(skillName: string): boolean {
	return REQUIRED_GLOBAL_SKILL_NAMES.includes(
		skillName as RequiredGlobalSkillName,
	);
}

export function getRequiredGlobalSkillReason(skillName: string): string | null {
	if (!isRequiredGlobalSkill(skillName)) {
		return null;
	}

	return "Required for skill discovery";
}
