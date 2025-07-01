import json
import time
from django.http import StreamingHttpResponse
from .models import Commands
from openai import OpenAI
from Portfolio.settings import API_KEY

try:

    client = OpenAI(
        api_key=API_KEY,
        base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
    )
except Exception as e:
    print(f"Error configuring GenAI: {e}")
    chat_model = None


# --- Existing Command Functions ---

def send_help():
    """
    Generates a styled HTML list of available commands, sorted by serial number.
    """
    html_output = '<h3>Available commands:</h3><ul>'
    all_commands = Commands.objects.exclude(name='help').order_by('serial')
    for command in all_commands:
        list_item = f'<li>[<span class="redtext">{command.serial}</span>] <span class="redtext">{command.name}</span> – {command.forwhat}</li>'
        html_output += list_item
    html_output += '</ul>'
    html_output += "<p>You can also type '<span class=\"redtext\">chat</span>' to talk to an AI assistant.</p>"
    html_output += '<p>NB: Enter Number or Write Command.</p>'
    return html_output


def process_command(command):
    """
    Processes standard, non-chat commands.
    """
    command_name = command.strip().lower()
    response_payload = {}

    try:
        if command_name == 'help' or command_name == 'dir':
            html_output = send_help()
            response_payload = {
                "type": 'html',
                "content": html_output
            }
        elif command_name == 'chat':
            # This message is shown when the user first types 'chat'
            response_payload = {
                "type": 'html',
                "content": "Entered chat mode. Type your message or '<span class=\"redtext\">quit</span>' to exit."
            }
        else:
            # Try to find command by name or serial number
            try:
                command_obj = Commands.objects.get(name=command_name)
            except Commands.DoesNotExist:
                if command_name.isdigit():
                    command_obj = Commands.objects.get(serial=int(command_name))
                else:
                    raise Commands.DoesNotExist

            response_payload = {
                "type": command_obj.response_type,
                "content": command_obj.response
            }

    except Commands.DoesNotExist:
        response_payload = {
            "type": "text",
            "content": f"'{command}' is not recognized as an internal or external command"
        }
    except Exception as e:
        response_payload = {
            "type": "text",
            "content": f"An error occurred on the server: {str(e)}"
        }

    yield f"data: {json.dumps(response_payload)}\n\n"
    yield "data: [DONE]\n\n"


def terminal_api(request):
    """
    Handles standard terminal commands.
    """
    command = request.GET.get('command', '')
    response = StreamingHttpResponse(process_command(command), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    return response


def chat_stream_wrapper(message):
    """
    Wraps the chat streaming to send loading signals.
    """
    # 1. Immediately send a "start loading" signal to the frontend.
    start_loading_payload = {"type": "loading", "content": True}
    yield f"data: {json.dumps(start_loading_payload)}\n\n"

    # 2. Now, call the streaming function and yield its results.
    yield from stream_chat_response(message)


def stream_chat_response(message):
    """
    A generator function that streams the AI's response token by token.
    """

    try:
        response = client.chat.completions.create(
            model="gemini-2.0-flash",
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Format your responses using Markdown. Use numbered lists, bullet points, and other formatting where appropriate."},
                {"role": "user", "content": message}
            ],
            stream=True
        )
        for chunk in response:
            payload_content = chunk.choices[0].delta.content
            if payload_content:
                payload_obj = {"type": "chunk", "content": payload_content}
                yield f"data: {json.dumps(payload_obj)}\n\n"

    except Exception as e:
        error_payload = {"type": "error", "content": f"\n<span class='redtext'>An error occurred with the AI service: {str(e)}</span>"}
        yield f"data: {json.dumps(error_payload)}\n\n"
    finally:
        yield "data: [DONE]\n\n"


def chat_api(request):
    """
    The view that handles streaming chat requests.
    """
    message = request.GET.get('message', '')
    if not message:
        return StreamingHttpResponse((b"data: [DONE]\n\n",), content_type='text/event-stream')

    response = StreamingHttpResponse(chat_stream_wrapper(message), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    return response