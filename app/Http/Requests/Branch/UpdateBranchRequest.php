<?php
namespace App\Http\Requests\Branch;
use Illuminate\Foundation\Http\FormRequest;
class UpdateBranchRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        $id = $this->route('branch')?->id;
        return [
            'name'          => "sometimes|string|max:100|unique:branches,name,{$id}",
            'code'          => "sometimes|string|max:10|unique:branches,code,{$id}",
            'address'       => 'nullable|string|max:255',
            'phone'         => 'nullable|string|max:20',
            'email'         => 'nullable|email|max:100',
            'is_active'     => 'boolean',
            'manager_id'    => 'nullable|integer|exists:users,id',
            'opening_time'  => 'nullable|string',
            'closing_time'  => 'nullable|string',
        ];
    }
}
