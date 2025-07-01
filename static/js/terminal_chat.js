// --- Make the DIV element draggable and resizable ---

const terminal = document.getElementById("terminal");
const header = terminal.querySelector(".terminal-header");
const resizer = document.getElementById("resizer");
const terminalBody = document.getElementById("terminal-body");
const commandInput = document.getElementById("commands");
const contentBox = document.querySelector('.contentbox');
const dirText = document.getElementById('dirtext'); // Get the prompt element

// --- STATE MANAGEMENT ---
let isChatMode = false; // Add a state variable for chat mode

// --- DRAGGING LOGIC (No changes) ---
let isDragging = false;
let offsetX, offsetY;

header.addEventListener("mousedown", (e) => {
    isDragging = true;
    offsetX = e.clientX - terminal.offsetLeft;
    offsetY = e.clientY - terminal.offsetTop;
    terminal.classList.add("dragging");
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const newLeft = e.clientX - offsetX;
    const newTop = e.clientY - offsetY;
    terminal.style.left = `${newLeft}px`;
    terminal.style.top = `${newTop}px`;
});

document.addEventListener("mouseup", () => {
    isDragging = false;
    terminal.classList.remove("dragging");
});

// --- FOCUS LOGIC (No changes) ---
terminalBody.addEventListener("click", () => {
    commandInput.focus();
});
commandInput.focus();

// --- RESIZING LOGIC (No changes) ---
let isResizing = false;
let originalWidth, originalHeight, originalMouseX, originalMouseY;

resizer.addEventListener("mousedown", (e) => {
    isResizing = true;
    originalWidth = terminal.offsetWidth;
    originalHeight = terminal.offsetHeight;
    originalMouseX = e.clientX;
    originalMouseY = e.clientY;
    e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
    if (!isResizing) return;
    const width = originalWidth + (e.clientX - originalMouseX);
    const height = originalHeight + (e.clientY - originalMouseY);
    terminal.style.width = `${width}px`;
    terminal.style.height = `${height}px`;
});

document.addEventListener("mouseup", () => {
    isResizing = false;
});


// =======================================================================
// --- COMMAND HANDLING (REVISED) ---
// =======================================================================

// Helper function to scroll the terminal body to the bottom
function scrollToBottom() {
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

function updatePrompt() {
    if (isChatMode) {
        dirText.innerHTML = '(<span style="color: white;">chat</span>)shoron@portfolio: ~';
    } else {
        dirText.innerHTML = 'shoron@portfolio: ~';
    }
}

commandInput.addEventListener('keydown', function(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const commandText = commandInput.value.trim();
    if (commandText === '') return;

    // Echo the user's command to the terminal with the correct prompt
    const oldCommand = document.createElement('div');
    oldCommand.classList.add('oldcommands');
    // Use the innerHTML of the prompt so it matches the current mode
    oldCommand.innerHTML = `<span class="dir">${dirText.innerHTML}</span> ${commandText}`;
    contentBox.appendChild(oldCommand);

    commandInput.value = '';
    scrollToBottom();

    // --- MODE SWITCHING AND COMMAND ROUTING ---

    // Handle 'cls' or 'clear' globally
    if (commandText.toLowerCase() === 'cls' || commandText.toLowerCase() === 'clear') {
        contentBox.innerHTML = '';
        return;
    }

    // If in chat mode
    if (isChatMode) {
        if (commandText.toLowerCase() === 'quit') {
            isChatMode = false;
            updatePrompt();
            const exitMessage = document.createElement('div');
            exitMessage.classList.add('contenttext');
            exitMessage.innerHTML = "Exited chat mode.";
            contentBox.appendChild(exitMessage);
            scrollToBottom();
        } else {
            handleChat(commandText); // Send message to AI
        }
    }
    // If in normal mode
    else {
        if (commandText.toLowerCase() === 'chat') {
            isChatMode = true;
            updatePrompt();
            // The backend will send the "Entering chat mode..." message
            handleBackendCommand(commandText);
        } else {
            handleBackendCommand(commandText); // Handle normal command
        }
    }
});


function handleChat(message) {
    commandInput.disabled = true;

    const responseContainer = document.createElement('div');
    responseContainer.classList.add('contenttext');
    // Add a class for styling the AI response specifically
    responseContainer.classList.add('ai-response');
    contentBox.appendChild(responseContainer);
    scrollToBottom();

    const chatApiUrl = `/api/chat/?message=${encodeURIComponent(message)}`;
    const eventSource = new EventSource(chatApiUrl);

    let fullResponse = '';

    eventSource.onmessage = function(event) {
        // Handle the final 'DONE' signal
        if (event.data === '[DONE]') {
            // Final processing: Parse Markdown if the library is available
            try {
                const finalHtml = typeof marked !== 'undefined'
                    ? marked.parse(fullResponse)
                    : fullResponse.replace(/\n/g, '<br>'); // Basic fallback
                responseContainer.innerHTML = finalHtml;
            } catch (e) {
                console.error("Markdown parsing failed:", e);
                responseContainer.innerText = fullResponse; // Fallback to plain text on error
            }

            scrollToBottom();
            eventSource.close();
            commandInput.disabled = false;
            commandInput.focus();
            return;
        }

        // Parse the incoming JSON data from the server
        const data = JSON.parse(event.data);

        // --- THIS IS THE MAIN FIX ---
        // Handle different message types sent from the backend
        switch (data.type) {
            case 'loading':
                // This handles the initial "loading" signal from chat_stream_wrapper
                responseContainer.innerHTML = '<i>AI is thinking...</i>';
                break;

            case 'chunk':
                // This handles a piece of the AI's response
                if (data.content) {
                    fullResponse += data.content;
                    // To make it look like it's typing, we can update the innerText
                    // The final HTML render will happen when [DONE] is received
                    responseContainer.innerText = fullResponse;
                    scrollToBottom();
                }
                break;

            case 'error':
                // This handles any errors sent from the backend
                if (data.content) {
                    // Append the error to the container and stop
                    responseContainer.innerHTML = fullResponse + data.content;
                    eventSource.close();
                    commandInput.disabled = false;
                    commandInput.focus();
                }
                break;
        }
    };

    eventSource.onerror = function(err) {
        console.error("Chat EventSource failed:", err);
        responseContainer.innerHTML += `<span class="redtext">Error: Lost connection to the chat server.</span>`;
        scrollToBottom();
        eventSource.close();
        commandInput.disabled = false;
        commandInput.focus();
    };
}