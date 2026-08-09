"use client";

export const genericAdministrativeReasons = [
  "Approved setup change.",
  "Owner-approved update.",
  "Correct inaccurate details.",
  "Replace outdated configuration.",
  "Routine administrative maintenance.",
] as const;

export function ReasonPresetChips({
  onSelect,
  presets = genericAdministrativeReasons,
  selected,
}: {
  onSelect: (reason: string) => void;
  presets?: readonly string[];
  selected: string;
}) {
  return (
    <div aria-label="Quick reason options" className="reason-preset-chips">
      {presets.map((reason) => (
        <button
          aria-pressed={selected === reason}
          className={selected === reason ? "selected" : undefined}
          key={reason}
          onClick={() => onSelect(reason)}
          type="button"
        >
          {reason.replace(/\.$/, "")}
        </button>
      ))}
    </div>
  );
}
