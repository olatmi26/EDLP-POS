<?php

namespace App\Http\Requests\Supplier;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        // Note: unique constraints (if any) should be handled separately to avoid
        // accidental conflicts during updates.
        return [
            'name'            => ['sometimes', 'required', 'string', 'max:255'],
            'company_name'   => ['nullable', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'email'          => ['nullable', 'email', 'max:255'],
            'phone'          => ['nullable', 'string', 'max:20'],
            'phone_alt'      => ['nullable', 'string', 'max:20'],
            'address'        => ['nullable', 'string'],
            'city'           => ['nullable', 'string', 'max:255'],
            'state'          => ['nullable', 'string', 'max:255'],
            'notes'          => ['nullable', 'string'],
            'is_active'      => ['nullable', 'boolean'],
        ];
    }
}

