# App Road Map

## Bug in rubric
- Rubric can remain in editing mode and when we switch to scoring it is still in editing mode.
- That is weird
- Fix: Ensure editing switches off when moving away from the screen

## Bug in ChatView
- List of Chats lists Chat 1, Chat 2 in opposite order to the order they were done
- Fix: reverse the order

## Prompt logging feature
- *Purpose* inspecting the shape of prompts, including the system prompt.
- *Function*: Be able to inspect the prompts that are sent to the LLM.
- *Implementation*: Save the log details in a database table. Save the log as an md file.

## Energy use logging feature
- *Purpose*: Keep track of energy consumed during LLM processes
- *Function*: Report to the user how much a particular process has used in tree CO2 absorption etc.
- *Implementation*: Each time the LLM runs inference, keep track of computer energy usage in; store each run use in a database table. Summarize the runs (chart, average, total, etc) on the frontend in a "energy tracker" type tab.

## LLM Switch
- *Purpose*: Allow the user to turn the LLM on and off so that they do not have to leave it taking memory if they need to switch to another activity.
- *Function*: Allow the user to turn the LLM on and off.
- *Implementation*: Create a toggle in the "Your LLM" LLMSelector area that will switch off or on the server.

## Fix apply comment button
- *Purpose*: The apply button doesn't really do anything because when the user generates a file, it applies all the feedback regardless. Ensure feedback is attached to generated document *only* if applied.
- *Function* Allow generation of document with only comments that are applied.
- *Implementation*: Fix the apply button.

## Generate feedback comment: "Compare with ideal text"
- *Purpose*: To provide feedback on writing in comparison to an ideal text
- *Function*: User provides an "ideal" text for comparison to the user's text
- *Implementation* In Rubric, add an "Ideal example" essay that would score well on the given rubric. The LLM will go through a two-step process: 1. Find weaknesses in the learner text relative to ideal text; 2. Restate those weaknesses in terms of just the learner text (no reference to the ideal text). The feedback will be provided in the chat. Selectable as option in the ChatInterface only if an ideal text has been set.

## Generate feedback comment: "Compare with weak text"
- *Purpose*: To provide feedback on writing in comparison to a weak text
- *Function*: User provides a "weak" text for comparison to the user's text
- *Implementation* In Rubric, add a "Weak example" essay that would score poorly on the given rubric. The LLM will go through a two-step process: 1. Find strengths in the learner text relative to weak text; 2. Restate those strengths in terms of just the learner text (no reference to the weak text). The feedback will be provided in the chat. Selectable as an option in the ChatInterface only if a weak text has been set.

## Push Comment
- *Purpose*: To take a response from the LLM and push it into a block comment bubble.
- *Function*: To make use of LLM responses as part of feedback and be able to edit them.
- *Implementation*: Create a *push* button after each response. md text such as ** and # tags should be removed from the comment. In the comment bubble, this will be acknowledged as an LLM Assistant comment, but if the teacher edits it, it will be noted as an LLM Assistant + Teacher comment.

## Send to LLM - long term goal
- *Purpose*: To get a second opinion from the LLM.
- *Function*: A teacher may wonder if they are being too hard in one of their comments, so they can get an accuracy check back from the LLM.
- *Implementation*: The essay, selected text and teacher comment is sent to the LLM. This is followed by a question for the LLM to consider. The questions need to be designed as a long term goal, but could include things like "is this too harsh?" or "is this feedback accurate?". The questions asked can be set by the user. Currently a dropdown menu has "evaluate thesis" and "evaluate hedging" as options, but this doesn't work here. Better to provide options like "harshness" and "accuracy" or other areas where teachers might prefer to get concrete comments from the LLM. LLM comments should appear in the chat. These are a kind of support for the teacher.

## Rubric feedback
- *Purpose*: To have the LLM provide rubric focused feedback
- *Function*: To give feedback in terms of the criteria on the rubric.
- *Implmentation*: The rubric is sent to the LLM one category at a time and the LLM uses it to provide feedback. It may be necessary to "summarize" the rubric so that its key points are extracted from the rubric as opposed to complex details about what counts as a score of 5 or 4 or 3. Any reference to scores should also be removed to avoid the LLM providing scored feedback. This is selectable as an option in the ChatInterface only if a rubric has been selected.

## Attach score to feedback
- *Purpose*: To provide the rubric and a scoring table on the generated document
- *Function*: User gives the score using the rubric and when the document is generated, this appears at the bottom of the document.
- *Implementation* The score is currently scored in the database for later retrieval but it is not yet added to the document so we need to investigate how this can be done.

## Bulk comment - long term goal
- *Purpose*: To have the LLM loop through all the files and attach comments.
- *Function*: User should select Bulk Comment from the ChatInterface and then just click send.
- *Implementation*: Create a new tab called Bulk Comment. In this tab, the user can select the *types* of comments that they want to have the LLM perform for them. They can also select a style, set a maximum length per comment etc. (Design this in more detail). Once these settings are set, they can then choose Bulk Comment from the ChatInterface menu. Bulk comment needs to automatically loop through the documents in the workspace so that the user can visually set what is happening to each document.
- *Long term plan*: We need to consider what types of comments are appropriate for bulk comment.
