import pandas as pd
import pytest

from DashAI.back.dataloaders.classes.dashai_dataset import (
    to_dashai_dataset,
    transform_dataset_with_schema,
)
from DashAI.back.initial_components import get_initial_components
from DashAI.back.tasks.instruction_tuning_task import InstructionTuningTask


def _dataset(**columns):
    schema = {
        "instruction": {"type": "Text", "dtype": "string"},
        "input": {"type": "Text", "dtype": "string"},
        "output": {"type": "Text", "dtype": "string"},
        "score": {"type": "Float", "dtype": "float64"},
    }
    frame = pd.DataFrame(columns)
    return transform_dataset_with_schema(
        to_dashai_dataset(frame), {name: schema[name] for name in frame.columns}
    )


INSTRUCTIONS = ["Summarize the ticket.", "Translate to Spanish."]
INPUTS = ["The printer does not print.", "Good morning."]
OUTPUTS = ["Printer failure.", "Buenos días."]


def test_the_task_is_registered():
    assert InstructionTuningTask in get_initial_components()


def test_the_task_declares_an_instruction_a_context_and_a_response():
    roles = {role.name: role for role in InstructionTuningTask.column_roles()}

    assert list(roles) == ["instruction", "context", "response"]
    assert roles["instruction"].required
    assert not roles["context"].required
    assert roles["response"].required


def test_no_role_is_transformed_by_the_preprocessing():
    metadata = InstructionTuningTask.get_metadata()

    assert metadata["takes_preprocessing"] is False


def test_the_instruction_and_the_context_feed_the_inputs():
    io = InstructionTuningTask().io_columns(
        {"instruction": ["instruction"], "context": ["input"], "response": ["output"]}
    )

    assert io.inputs == ["instruction", "input"]
    assert io.outputs == ["output"]


@pytest.mark.parametrize(
    ("inputs", "roles"),
    [
        (
            ["instruction", "input"],
            {"instruction": ["instruction"], "context": ["input"]},
        ),
        (["instruction"], {"instruction": ["instruction"], "context": []}),
    ],
)
def test_the_roles_come_back_from_the_inputs(inputs, roles):
    assert InstructionTuningTask().roles_from_io(inputs, ["output"]) == {
        **roles,
        "response": ["output"],
    }


def test_an_alpaca_dataset_is_accepted():
    dataset = _dataset(instruction=INSTRUCTIONS, input=INPUTS, output=OUTPUTS)

    prepared = InstructionTuningTask().prepare_for_task(
        dataset, ["instruction", "input"], ["output"]
    )

    assert len(prepared) == 2


def test_the_context_is_optional():
    dataset = _dataset(instruction=INSTRUCTIONS, output=OUTPUTS)

    prepared = InstructionTuningTask().prepare_for_task(
        dataset, ["instruction"], ["output"]
    )

    assert len(prepared) == 2


def test_a_response_that_is_not_text_is_rejected():
    dataset = _dataset(instruction=INSTRUCTIONS, score=[1.0, 2.0])

    with pytest.raises(TypeError):
        InstructionTuningTask().prepare_for_task(dataset, ["instruction"], ["score"])


def test_a_dataset_without_a_response_is_rejected():
    dataset = _dataset(instruction=INSTRUCTIONS, input=INPUTS)

    with pytest.raises(ValueError, match="Output cardinality"):
        InstructionTuningTask().prepare_for_task(dataset, ["instruction", "input"], [])
