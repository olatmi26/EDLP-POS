<?php
namespace App\Http\Requests\Auth;
use Illuminate\Foundation\Http\FormRequest;
class PinLoginRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'staff_id'  => 'required|string',
            'pin'       => 'required|string|digits_between:4,6',
            // Branch is mapped to the user; allow auto-detection.
            'branch_id' => 'sometimes|nullable|integer|exists:branches,id',
        ];
    }
}
