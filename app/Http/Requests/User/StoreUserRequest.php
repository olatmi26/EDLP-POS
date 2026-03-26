<?php
namespace App\Http\Requests\User;
use Illuminate\Foundation\Http\FormRequest;
class StoreUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'name'              => 'required|string|max:150',
            'email'             => 'required|email|unique:users,email',
            'password'          => 'nullable|string|min:8',
            'phone'             => 'nullable|string|max:20',
            'branch_id'         => 'required|integer|exists:branches,id',
            'role'              => 'required|in:super-admin,admin,branch-manager,cashier',
            'is_active'         => 'boolean',
            'pin'               => 'nullable|string|digits:4',
            'pin_login_enabled' => 'boolean',
        ];
    }
}
