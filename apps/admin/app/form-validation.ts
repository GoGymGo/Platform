type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

function isFormControl(element: unknown): element is FormControl {
  return (
    element instanceof HTMLInputElement ||
    element instanceof HTMLSelectElement ||
    element instanceof HTMLTextAreaElement
  );
}

function humanizeName(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function controlLabel(control: FormControl): string {
  const explicit = control.dataset.validationLabel?.trim();
  if (explicit) return explicit;

  const ariaLabel = control.getAttribute("aria-label")?.trim();
  if (ariaLabel) return ariaLabel;

  const label = control.closest("label");
  const labelSpan = label?.querySelector(":scope > span")?.textContent?.trim();
  if (labelSpan) return labelSpan;

  const directLabelText = Array.from(label?.childNodes ?? [])
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent?.trim() ?? "")
    .filter(Boolean)
    .join(" ");
  if (directLabelText) return directLabelText;

  return humanizeName(control.name || "This field");
}

function controlError(control: FormControl): string {
  const label = controlLabel(control);
  const customMessage = control.dataset.validationMessage?.trim();
  if (customMessage) return customMessage;

  if (control.validity.valueMissing) {
    if (control instanceof HTMLInputElement && control.type === "checkbox") {
      return `${label} must be confirmed before continuing.`;
    }
    if (control instanceof HTMLSelectElement) {
      return `Choose ${label.toLowerCase()}.`;
    }
    return `${label} is required.`;
  }
  if (control.validity.typeMismatch) {
    if (control instanceof HTMLInputElement && control.type === "email") {
      return `${label} must be a valid email address.`;
    }
    if (control instanceof HTMLInputElement && control.type === "url") {
      return `${label} must be a complete web address beginning with https://.`;
    }
    return `${label} is not in the expected format.`;
  }
  if (control.validity.patternMismatch) {
    return `${label} is not in the expected format.`;
  }
  if (control.validity.tooShort) {
    const minimum =
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement
        ? control.minLength
        : 0;
    return `${label} must be at least ${minimum} characters.`;
  }
  if (control.validity.tooLong) {
    const maximum =
      control instanceof HTMLInputElement ||
      control instanceof HTMLTextAreaElement
        ? control.maxLength
        : 0;
    return `${label} must be no more than ${maximum} characters.`;
  }
  if (control.validity.rangeUnderflow) {
    const minimum = control instanceof HTMLInputElement ? control.min : "";
    return `${label} must be ${minimum} or higher.`;
  }
  if (control.validity.rangeOverflow) {
    const maximum = control instanceof HTMLInputElement ? control.max : "";
    return `${label} must be ${maximum} or lower.`;
  }
  if (control.validity.stepMismatch || control.validity.badInput) {
    return `${label} must be a valid number.`;
  }
  return `${label} needs to be corrected before continuing.`;
}

export function formValidationError(form: HTMLFormElement): string {
  const controls: FormControl[] = [];
  form.querySelectorAll("input, select, textarea").forEach((element) => {
    if (isFormControl(element)) controls.push(element);
  });

  controls.forEach((control) => control.removeAttribute("aria-invalid"));
  const invalidControls = controls.filter(
    (control) => !control.disabled && !control.validity.valid,
  );
  if (invalidControls.length === 0) return "";

  invalidControls.forEach((control) =>
    control.setAttribute("aria-invalid", "true"),
  );
  invalidControls[0]?.focus();

  const errors = [...new Set(invalidControls.map(controlError))];
  return `Please fix the following: ${errors.join(" ")}`;
}
