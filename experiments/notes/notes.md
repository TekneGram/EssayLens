# Decision Makers
Decision makers read the text and determine what tool to call to provide further feedback.

## System Prompt: decision_maker.md
This system prompt tries to make the LLM become a decision maker between two decisions. It must select only one of them.

## System Prompt: multiple_decision_maker.md
This sytem prompt has the LLM judge amongst multiple options about which tools to call based on yes/no questions. This is a longer prompt, and is predicted to be less reliable with smaller LLMs because it is a cognitively complex task.

# Feedback prompts
Feedback prompts are focused on one specific language, organizational, rhetorical or content based type of feedback.

## Feedback type: paragraph_feedback_examples.md
This prompt tells the LLM about paragraph organization.
It then suggests reconfiguring the organization so that an example becomes part of the controlling idea, giving the paragraph much more focus. This is followed by asking for suggestions about how to develop this new controlling idea.

## Feedback type: paragraph_feedback_topic_sentence.md
This prompt has the LLM determine whether the supporting sentences develop the controlling idea in the topic sentence. It offers praise if so or offers suggestions for changes if not.