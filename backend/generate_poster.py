# generate_poster.py (UPDATED)

import sys
import json
from PIL import Image, ImageDraw, ImageFont

def generate_registration_poster(name, admission_no, selected_events, output_filename):
    # ... [Keep the image generation logic as before] ...
    width = 800
    height = int(width * 5 / 4) # 4:5 aspect ratio
    img = Image.new('RGB', (width, height), color = 'white')
    draw = ImageDraw.Draw(img)

    # Load font (Replace with your actual font paths if 'arial' isn't available)
    try:
        title_font = ImageFont.truetype("arialbd.ttf", 40)
        header_font = ImageFont.truetype("arialbd.ttf", 30)
        text_font = ImageFont.truetype("arial.ttf", 25)
        event_font = ImageFont.truetype("arial.ttf", 20)
    except IOError:
        title_font = ImageFont.load_default()
        header_font = ImageFont.load_default()
        text_font = ImageFont.load_default()
        event_font = ImageFont.load_default()

    # Title
    title_text = "PEECKA CIS Arts Fest 2025-26"
    bbox = draw.textbbox((0,0), title_text, font=title_font)
    text_width = bbox[2] - bbox[0]
    draw.text(((width - text_width) / 2, 50), title_text, font=title_font, fill=(0, 0, 0))

    # Participant Details
    y_offset = 150
    draw.text((50, y_offset), "Participant Details:", font=header_font, fill=(0, 0, 0))
    y_offset += 50
    draw.text((70, y_offset), f"Name: {name}", font=text_font, fill=(0, 0, 0))
    y_offset += 40
    draw.text((70, y_offset), f"Admission No.: {admission_no}", font=text_font, fill=(0, 0, 0))
    
    # Registered Events
    y_offset += 70
    draw.text((50, y_offset), "Registered Events:", font=header_font, fill=(0, 0, 0))
    y_offset += 50
    if selected_events:
        for i, event in enumerate(selected_events):
            if y_offset > height - 100:
                draw.text((70, y_offset), "...", font=event_font, fill=(0,0,0))
                break
            draw.text((70, y_offset), f"- {event}", font=event_font, fill=(0, 0, 0))
            y_offset += 30
    else:
        draw.text((70, y_offset), "No events selected.", font=text_font, fill=(0, 0, 0))


    img.save(output_filename)
    # Print the path so the calling script (Node.js) knows where to find the image
    print(output_filename)


if __name__ == "__main__":
    # Expects three arguments: Name, Admission No., and JSON string of events
    if len(sys.argv) < 4:
        # This message will be caught as an error by Node.js
        sys.stderr.write("Usage: python generate_poster.py <name> <admission_no> <json_events>\n")
        sys.exit(1)

    name = sys.argv[1]
    admission_no = sys.argv[2]
    # The events are passed as a JSON string
    try:
        events = json.loads(sys.argv[3])
    except json.JSONDecodeError:
        sys.stderr.write("Error decoding event list JSON.\n")
        sys.exit(1)

    # Create a unique filename based on the admission number
    filename = f"posters/{admission_no}_poster.png"
    
    generate_registration_poster(name, admission_no, events, filename)