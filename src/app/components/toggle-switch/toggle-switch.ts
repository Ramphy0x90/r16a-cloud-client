import { Component, forwardRef } from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
	selector: 'toggle-switch',
	imports: [FormsModule],
	templateUrl: './toggle-switch.html',
	styleUrl: './toggle-switch.css',
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => ToggleSwitch),
			multi: true,
		},
	],
})
export class ToggleSwitch implements ControlValueAccessor {
	value: boolean = false;
	disabled: boolean = false;

	private onChange = (value: boolean) => {};
	private onTouched = () => {};

	writeValue(value: boolean): void {
		this.value = value;
	}

	registerOnChange(fn: (value: boolean) => void): void {
		this.onChange = fn;
	}

	registerOnTouched(fn: () => void): void {
		this.onTouched = fn;
	}

	setDisabledState(isDisabled: boolean): void {
		this.disabled = isDisabled;
	}

	toggle() {
		if (this.disabled) return;

		this.onChange(this.value);
		this.onTouched();
	}
}
