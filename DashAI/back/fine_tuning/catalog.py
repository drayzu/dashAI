from copy import deepcopy
from typing import Any

from DashAI.back.models.hugging_face.qwen_model import (
    Qwen25_05BInstruct,
    Qwen25_15BInstruct,
)

BUILTIN_FINE_TUNING_MODELS = (Qwen25_05BInstruct, Qwen25_15BInstruct)
MODEL_CATALOG: dict[str, dict[str, Any]] = {
    component.FINE_TUNING["key"]: deepcopy(component.FINE_TUNING)
    for component in BUILTIN_FINE_TUNING_MODELS
}


def get_model_catalog() -> dict[str, dict[str, Any]]:
    """Return trainable models declared by registered DashAI components."""
    result = deepcopy(MODEL_CATALOG)
    try:
        from kink import di

        registry = di["component_registry"]
        components = registry.get_components_by_types(select=["GenerativeModel"])
    except Exception:
        return result
    for component in components:
        declaration = (component.get("metadata") or {}).get("fine_tuning")
        if declaration and declaration.get("key"):
            result[declaration["key"]] = deepcopy(declaration)
    return result


PRESET_CATALOG: dict[str, dict[str, Any]] = {
    "quick_test": {
        "name": "Quick test",
        "description": "32 examples and three optimizer steps.",
        "parameters": {
            "preset": "quick_test",
            "max_samples": 32,
            "max_steps": 3,
            "num_train_epochs": 1.0,
            "max_length": 128,
            "per_device_train_batch_size": 1,
            "gradient_accumulation_steps": 1,
            "learning_rate": 0.0002,
            "lora_r": 8,
            "lora_alpha": 16,
            "lora_dropout": 0.05,
            "target_modules": "all-linear",
            "seed": 42,
            "warmup_steps": 0,
            "logging_steps": 1,
            "save_steps": 1,
            "eval_steps": 1,
        },
    },
    "qlora_8gb": {
        "name": "QLoRA 8 GB",
        "description": "Conservative QLoRA preset for an 8 GB NVIDIA GPU.",
        "parameters": {
            "preset": "qlora_8gb",
            "max_samples": 1000,
            "max_steps": 100,
            "num_train_epochs": 1.0,
            "max_length": 256,
            "per_device_train_batch_size": 1,
            "gradient_accumulation_steps": 8,
            "learning_rate": 0.0002,
            "lora_r": 16,
            "lora_alpha": 32,
            "lora_dropout": 0.05,
            "target_modules": "all-linear",
            "seed": 42,
            "warmup_steps": 5,
            "logging_steps": 1,
            "save_steps": 25,
            "eval_steps": 25,
        },
    },
    "lora_small": {
        "name": "LoRA small",
        "description": "FP16 LoRA for small models when 4-bit is unavailable.",
        "parameters": {
            "preset": "lora_small",
            "max_samples": 1000,
            "max_steps": 100,
            "num_train_epochs": 1.0,
            "max_length": 256,
            "per_device_train_batch_size": 1,
            "gradient_accumulation_steps": 8,
            "learning_rate": 0.0002,
            "lora_r": 16,
            "lora_alpha": 32,
            "lora_dropout": 0.05,
            "target_modules": "all-linear",
            "seed": 42,
            "warmup_steps": 5,
            "logging_steps": 1,
            "save_steps": 25,
            "eval_steps": 25,
        },
    },
}


def resolve_model(model_id: str) -> dict[str, Any]:
    """Resolve a curated catalog key without accepting arbitrary repositories."""
    try:
        return deepcopy(get_model_catalog()[model_id])
    except KeyError as exc:
        raise ValueError(f"Unsupported base model: {model_id}") from exc


def get_catalog() -> dict[str, Any]:
    # Deferred import: unsloth_backend pulls the training stack, and the
    # catalog module is imported at application startup.
    from DashAI.back.fine_tuning.unsloth_backend import unsloth_capabilities

    unsloth = unsloth_capabilities()
    return {
        "models": deepcopy(list(get_model_catalog().values())),
        "presets": deepcopy(PRESET_CATALOG),
        "capabilities": {
            "methods": ["lora", "qlora"],
            "dataset_formats": ["text", "prompt_completion", "messages"],
            "distributed_training": False,
            "gguf_export": False,
            "unsloth": unsloth["available"],
            "unsloth_version": unsloth["version"],
            "unsloth_reason": unsloth["reason"],
        },
    }
