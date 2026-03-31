<?php
namespace App\Http\Requests\User;
use Illuminate\Foundation\Http\FormRequest;
class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        $id = $this->route('user')?->id;
        return [
            'name'              => 'sometimes|string|max:150',
            'email'             => "sometimes|email|unique:users,email,{$id}",
            'phone'             => 'nullable|string|max:20',
            'branch_id'         => 'sometimes|integer|exists:branches,id',
            'role'              => 'nullable|in:super-admin,admin,branch-manager,cashier',
            'is_active'         => 'boolean',
            'pin'               => 'nullable|string|digits:4',
            'pin_login_enabled' => 'boolean',
        ];
    }
}
