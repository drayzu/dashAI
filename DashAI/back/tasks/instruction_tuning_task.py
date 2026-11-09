"""DashAI Instruction Tuning Task."""

from typing import Dict, List, Mapping, Sequence

from DashAI.back.core.utils import MultilingualString
from DashAI.back.tasks.column_roles import ColumnRole, IOColumns
from DashAI.back.tasks.supervised_task import SupervisedTask
from DashAI.back.types.value_types import Text

INSTRUCTION = "instruction"
CONTEXT = "context"
RESPONSE = "response"


class InstructionTuningTask(SupervisedTask):
    """Adapt a language model to answer instructions the way a dataset does.

    Each row is an example of supervised fine-tuning: an instruction, an
    optional context it refers to, and the response the model should learn to
    give. The instruction and the context build the prompt; the response is
    the target, and the only text the model is trained to produce.

    The roles are the task's own rather than the x/y short form, because the
    input is not one column: a dataset in the alpaca layout, for instance,
    brings ``instruction``, ``input`` and ``output``. No role is transformable.
    A language model reads raw text and tokenizes it itself, so the session's
    preprocessing has nothing to do on these columns.

    The system prompt is not a role: it is usually the same for every row, so
    it belongs with the model's parameters.
    """

    DESCRIPTION: str = MultilingualString(
        en=(
            "Adapt a language model to your own examples. Takes an instruction, "
            "optionally a context, and the response the model should learn."
        ),
        es=(
            "Adapta un modelo de lenguaje a tus propios ejemplos. Toma una "
            "instrucción, opcionalmente un contexto, y la respuesta que el "
            "modelo debe aprender."
        ),
        pt=(
            "Adapta um modelo de linguagem aos seus próprios exemplos. Recebe "
            "uma instrução, opcionalmente um contexto, e a resposta que o "
            "modelo deve aprender."
        ),
        de=(
            "Passt ein Sprachmodell an Ihre eigenen Beispiele an. Nimmt eine "
            "Anweisung, optional einen Kontext, und die Antwort, die das Modell "
            "lernen soll."
        ),
        zh="使用你自己的示例调整语言模型。接受一条指令、可选的上下文，以及模型应学习的回答。",
    )
    ICON: str = "Psychology"
    DISPLAY_NAME: str = MultilingualString(
        en="Instruction fine-tuning",
        es="Ajuste fino por instrucciones",
        pt="Ajuste fino por instruções",
        de="Feinabstimmung mit Anweisungen",
        zh="指令微调",
    )

    COLUMN_ROLES = (
        ColumnRole(
            name=INSTRUCTION,
            label=MultilingualString(
                en="Instruction",
                es="Instrucción",
                pt="Instrução",
                de="Anweisung",
                zh="指令",
            ),
            description=MultilingualString(
                en="What is asked of the model, for example a question or a task.",
                es="Lo que se le pide al modelo, por ejemplo una pregunta o una tarea.",
                pt="O que se pede ao modelo, por exemplo uma pergunta ou uma tarefa.",
                de="Was vom Modell verlangt wird, zum Beispiel eine Frage.",
                zh="向模型提出的要求，例如一个问题或一项任务。",
            ),
            types=(Text,),
            min=1,
            max=1,
        ),
        ColumnRole(
            name=CONTEXT,
            label=MultilingualString(
                en="Context",
                es="Contexto",
                pt="Contexto",
                de="Kontext",
                zh="上下文",
            ),
            description=MultilingualString(
                en="Optional text the instruction refers to, such as a document.",
                es="Texto opcional al que alude la instrucción, como un documento.",
                pt="Texto opcional ao qual a instrução se refere, como um documento.",
                de="Optionaler Text, auf den sich die Anweisung bezieht.",
                zh="指令所涉及的可选文本，例如一份文档。",
            ),
            types=(Text,),
            min=0,
            max=1,
        ),
        ColumnRole(
            name=RESPONSE,
            label=MultilingualString(
                en="Response",
                es="Respuesta",
                pt="Resposta",
                de="Antwort",
                zh="回答",
            ),
            description=MultilingualString(
                en="The answer the model should learn to give.",
                es="La respuesta que el modelo debe aprender a dar.",
                pt="A resposta que o modelo deve aprender a dar.",
                de="Die Antwort, die das Modell lernen soll.",
                zh="模型应学会给出的回答。",
            ),
            types=(Text,),
            min=1,
            max=1,
        ),
    )

    # The text metrics translation already scores with. A metric on the
    # validation loss, such as perplexity, comes with the models.
    COMPATIBLE_COMPONENTS = ["Bleu", "Chrf"]

    @classmethod
    def io_roles(cls) -> Dict[str, List[str]]:
        """The instruction and the context feed the inputs, the response the output."""
        return {"inputs": [INSTRUCTION, CONTEXT], "outputs": [RESPONSE]}

    def io_columns(self, roles: Mapping[str, Sequence]) -> IOColumns:
        """The instruction first, then the context when there is one."""
        return IOColumns(
            inputs=list(roles.get(INSTRUCTION) or []) + list(roles.get(CONTEXT) or []),
            outputs=list(roles.get(RESPONSE) or []),
        )

    def roles_from_io(
        self, input_columns: Sequence, output_columns: Sequence
    ) -> Dict[str, list]:
        """The roles that a model's input and output came from.

        The instruction is always the first input, so a second one can only be
        the context.
        """
        inputs = list(input_columns or [])
        return {
            INSTRUCTION: inputs[:1],
            CONTEXT: inputs[1:],
            RESPONSE: list(output_columns or []),
        }
