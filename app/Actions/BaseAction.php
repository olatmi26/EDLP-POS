<?php

namespace App\Actions;

abstract class BaseAction
{
    abstract public function execute(array $data): mixed;
}