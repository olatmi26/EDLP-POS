<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customer\StoreCustomerRequest;
use App\Http\Requests\Customer\UpdateCustomerRequest;
use App\Http\Resources\CustomerResource;
use App\Models\Customer;
use App\Services\CustomerService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CustomerController extends Controller
{
    public function __construct(private readonly CustomerService $customerService) {}

    /**
     * GET /api/customers
     */
    public function index(Request $request): JsonResponse
    {
        $query = Customer::with('branch')
            ->active()
            ->when($request->search, fn ($q, $s) => $q->search($s))
            ->when($request->branch_id && ($request->user()->isSuperAdmin() || $request->user()->isAdmin()),
                fn ($q, $id) => $q->where('branch_id', $id),
                fn ($q) => $q->where('branch_id', $request->branch_id)
            )
            ->orderBy('name');

        return $this->paginatedSuccess($query->paginate($request->get('per_page', 20)));
    }

    /**
     * POST /api/customers
     */
    public function store(StoreCustomerRequest $request): JsonResponse
    {
        $customer = Customer::create(array_merge(
            $request->validated(),
            ['branch_id' => $request->branch_id]
        ));

        return $this->created(new CustomerResource($customer), 'Customer created');
    }

    /**
     * GET /api/customers/{customer}
     */
    public function show(Customer $customer): JsonResponse
    {
        $customer->load(['branch', 'sales' => fn ($q) => $q->latest()->limit(10)]);

        return $this->success(new CustomerResource($customer));
    }

    /**
     * PUT /api/customers/{customer}
     */
    public function update(UpdateCustomerRequest $request, Customer $customer): JsonResponse
    {
        $customer->update($request->validated());

        return $this->success(new CustomerResource($customer->fresh('branch')), 'Customer updated');
    }

    /**
     * DELETE /api/customers/{customer}
     */
    public function destroy(Customer $customer): JsonResponse
    {
        $customer->update(['is_active' => false]);

        return $this->success(null, 'Customer deactivated');
    }

    /**
     * POST /api/customers/merge
     * Merge duplicate customer records by phone.
     */
    public function merge(Request $request): JsonResponse
    {
        $request->validate([
            'primary_id'   => 'required|integer|exists:customers,id',
            'secondary_id' => 'required|integer|exists:customers,id|different:primary_id',
        ]);

        $merged = $this->customerService->merge(
            $request->primary_id,
            $request->secondary_id
        );

        return $this->success(new CustomerResource($merged), 'Customers merged successfully');
    }

    /**
     * GET /api/customers/{customer}/suggestions
     * AI-powered product suggestions for POS.
     */
    public function suggestions(Customer $customer, Request $request): JsonResponse
    {
        $suggestions = $this->customerService->getSuggestions(
            $customer,
            $request->branch_id
        );

        return $this->success($suggestions);
    }

    /**
     * GET /api/customers/{customer}/purchase-history
     */
    public function purchaseHistory(Customer $customer): JsonResponse
    {
        $history = $customer->aiPurchaseHistory()
            ->with('product.category')
            ->orderByDesc('frequency')
            ->limit(50)
            ->get();

        return $this->success($history);
    }
}
