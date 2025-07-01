// --- Make the DIV element draggable and resizable ---

const terminal = document.getElementById("terminal");
const header = terminal.querySelector(".terminal-header");
const resizer = document.getElementById("resizer");
const terminalBody = document.getElementById("terminal-body");
const commandInput = document.getElementById("commands");
const contentBox = document.querySelector('.contentbox');


// --- DRAGGING LOGIC ---
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

// --- FOCUS LOGIC ---
terminalBody.addEventListener("click", () => {
    commandInput.focus();
});
commandInput.focus();


// --- RESIZING LOGIC ---
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
// --- SIMPLIFIED COMMAND HANDLING (NO EFFECTS) ---
// =======================================================================

// Helper function to scroll the terminal body to the bottom
function scrollToBottom() {
    terminalBody.scrollTop = terminalBody.scrollHeight;
}

commandInput.addEventListener('keydown', function(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    const commandText = commandInput.value.trim();
    if (commandText === '') return;

    // Echo the user's command to the terminal
    const oldCommand = document.createElement('div');
    oldCommand.classList.add('oldcommands');
    oldCommand.innerHTML = `<span class="dir">shoron@portfolio: ~</span> ${commandText}`;
    contentBox.appendChild(oldCommand);

    commandInput.value = '';
    scrollToBottom();

    // Handle 'cls' command on the frontend
    if (commandText.toLowerCase() === 'cls' || commandText.toLowerCase() === 'clear' || commandText.toLowerCase() === 'clean') {
        contentBox.innerHTML = '';
        return;
    }

    // Handle all other commands by calling the backend
    handleBackendCommand(commandText);
});


function handleBackendCommand(command) {
    commandInput.disabled = true; // Disable input while waiting

    // Create a container for the response
    const responseContainer = document.createElement('div');
    responseContainer.classList.add('contenttext');
    contentBox.appendChild(responseContainer);

    const baseUrl = window.location.origin;
    const ApiUrl = `${baseUrl}/api/terminal/?command=${encodeURIComponent(command)}`;

    const eventSource = new EventSource(ApiUrl);

    eventSource.onmessage = function(event) {
        // The [DONE] signal marks the end of the stream
        if (event.data === '[DONE]') {
            eventSource.close();
            commandInput.disabled = false; // Re-enable input
            commandInput.focus();
            return;
        }

        // Parse the JSON payload from the backend
        const data = JSON.parse(event.data);

        // Display the content instantly, whether it's HTML or text
        responseContainer.innerHTML = data.content;

        scrollToBottom();
    };

    eventSource.onerror = function(err) {
        console.error("EventSource failed:", err);
        responseContainer.innerHTML = `<span class="redtext">Error: Could not connect to the command server.</span>`;
        scrollToBottom();

        eventSource.close();

        // Re-enable input on error
        commandInput.disabled = false;
        commandInput.focus();
    };
}