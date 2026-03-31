<?php

namespace App\Exceptions;

use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Throwable;

class Handler extends ExceptionHandler
{
    protected $dontFlash = [
        'current_password',
        'password',
        'password_confirmation',
        'pin',
    ];

    public function register(): void
    {
        $this->renderable(function (AuthenticationException $e) {
            return response()->json(['success' => false, 'message' => 'Unauthenticated.'], 401);
        });

        $this->renderable(function (ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed.',
                'errors'  => $e->errors(),
            ], 422);
        });

        $this->renderable(function (NotFoundHttpException $e) {
            return response()->json(['success' => false, 'message' => 'Resource not found.'], 404);
        });

        $this->renderable(function (MethodNotAllowedHttpException $e) {
            return response()->json(['success' => false, 'message' => 'Method not allowed.'], 405);
        });
    }
}
