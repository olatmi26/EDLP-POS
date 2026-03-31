<?php
namespace App\Http\Requests\Branch;
use Illuminate\Foundation\Http\FormRequest;
class StoreBranchRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'name'          => 'required|string|max:100|unique:branches,name',
            'code'          => 'required|string|max:10|unique:branches,code',
            'address'       => 'nullable|string|max:255',
            'phone'         => 'nullable|string|max:20',
            'email'         => 'nullable|email|max:100',
            'is_head_office' => 'boolean',
            'is_active'     => 'boolean',
            'manager_id'    => 'nullable|integer|exists:users,id',
            'opening_time'  => 'nullable|string',
            'closing_time'  => 'nullable|string',
        ];
    }
}
