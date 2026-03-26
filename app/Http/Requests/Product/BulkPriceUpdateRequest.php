<?php
namespace App\Http\Requests\Product;
use Illuminate\Foundation\Http\FormRequest;
class BulkPriceUpdateRequest extends FormRequest
{
    public function authorize(): bool { return true; }
    public function rules(): array
    {
        return [
            'type'        => 'required|in:fixed,percentage',
            'value'       => 'required|numeric',
            'products'    => 'nullable|array',
            'products.*'  => 'integer|exists:products,id',
            'category_id' => 'nullable|integer|exists:categories,id',
            'reason'      => 'nullable|string|max:255',
        ];
    }
}
