import re

file_path = "/Users/r2k8/Library/CloudStorage/OneDrive-Personal/_Personal Docs/_Family/Travel or Trips/Yellowstone Road Trip - Aug 2026/site/trip/index.html"

with open(file_path, "r") as f:
    content = f.read()

# 1. Title and Header
content = content.replace("<title>Yellowstone 2026 | Family Trip</title>", "<title>Yellowstone Planner | Trip Template</title>")
content = content.replace('<p class="eyebrow">Family trip · Aug 19–24, 2026</p>', '<p class="eyebrow">Trip Template · Flexible Dates</p>')
content = content.replace('<h1>Yellowstone</h1>', '<h1>Yellowstone Planner</h1>')
content = content.replace('<p class="hero-sub">A compact, leave-friendly plan from Redmond to three nights inside the park.</p>', '<p class="hero-sub">A customizable 5-night plan from your hometown to the heart of the park.</p>')
content = content.replace('<span class="hero-fact"><i data-lucide="users"></i>Family of four</span>', '<span class="hero-fact"><i data-lucide="users"></i>Great for families</span>')
content = content.replace('<span class="hero-fact"><i data-lucide="briefcase-business"></i>2–2.5 leave days</span>', '<span class="hero-fact"><i data-lucide="briefcase-business"></i>Weekend-friendly</span>')
content = content.replace('<span class="hero-fact"><i data-lucide="circle-check"></i>Core trip confirmed</span>', '<span class="hero-fact"><i data-lucide="circle-check"></i>Customizable</span>')

# 2. Status Strip
content = content.replace('<span>Flights</span><strong>SEA ⇄ BZN</strong>', '<span>Flights</span><strong>Home ⇄ BZN</strong>')
content = content.replace('<span>Known total</span><strong>$1,617.97</strong>', '<span>Est. Budget</span><strong>Varies by season</strong>')

# 3. Route Section
route_original = """<div class="route-line">
          <div class="route-stop">
            <div class="route-time">3:15 PM</div><div class="route-icon"><i data-lucide="house"></i></div>
            <div class="route-copy"><strong>Leave Sixty-01</strong><p>Walk to Metro 245, or use a short rideshare to Redmond Technology Station with luggage.</p><a class="map-link" href="https://www.google.com/maps/dir/?api=1&amp;destination=Redmond%20Technology%20Station&amp;travelmode=transit" target="_blank" rel="noreferrer"><i data-lucide="navigation"></i>Directions</a></div>
          </div>
          <div class="route-stop">
            <div class="route-time">3:45 PM</div><div class="route-icon"><i data-lucide="train-front"></i></div>
            <div class="route-copy"><strong>2 Line to Bellevue</strong><p>Ride to Bellevue Downtown and walk to Transit Center Bay 6.</p><a class="map-link" href="https://www.google.com/maps/dir/?api=1&amp;destination=Bellevue%20Transit%20Center&amp;travelmode=transit" target="_blank" rel="noreferrer"><i data-lucide="navigation"></i>Directions</a></div>
          </div>
          <div class="route-stop">
            <div class="route-time">4:07 PM</div><div class="route-icon"><i data-lucide="bus-front"></i></div>
            <div class="route-copy"><strong>ST Express 560 to SEA</strong><p>Primary bus arrives about 5:10 PM. The 4:37 PM departure is the backup.</p><a class="map-link" href="https://www.google.com/maps/dir/?api=1&amp;destination=Seattle-Tacoma%20International%20Airport&amp;travelmode=transit" target="_blank" rel="noreferrer"><i data-lucide="navigation"></i>Directions</a></div>
          </div>
          <div class="route-stop">
            <div class="route-time">8:16 PM</div><div class="route-icon"><i data-lucide="plane"></i></div>
            <div class="route-copy"><strong>Alaska 1323 to Bozeman</strong><p>Nonstop flight, arriving BZN at 10:59 PM.</p><a class="map-link" href="https://www.google.com/maps/search/?api=1&amp;query=Bozeman%20Yellowstone%20International%20Airport" target="_blank" rel="noreferrer"><i data-lucide="map-pin"></i>View airport</a></div>
          </div>
          <div class="route-stop">
            <div class="route-time">11:30 PM</div><div class="route-icon"><i data-lucide="bed-double"></i></div>
            <div class="route-copy"><strong>Airport hotel</strong><p>Use the hotel shuttle. Collect the rental car Thursday morning after breakfast.</p><a class="map-link" href="https://www.google.com/maps/search/?api=1&amp;query=Hotels%20near%20Bozeman%20Yellowstone%20International%20Airport" target="_blank" rel="noreferrer"><i data-lucide="map-pin"></i>Nearby hotels</a></div>
          </div>
        </div>"""
route_new = """<div class="route-line">
          <div class="route-stop">
            <div class="route-time">Afternoon</div><div class="route-icon"><i data-lucide="house"></i></div>
            <div class="route-copy"><strong>Leave Home</strong><p>Head to your local airport.</p></div>
          </div>
          <div class="route-stop">
            <div class="route-time">Evening</div><div class="route-icon"><i data-lucide="plane"></i></div>
            <div class="route-copy"><strong>Flight to Bozeman (BZN)</strong><p>Try to arrive before midnight.</p><a class="map-link" href="https://www.google.com/maps/search/?api=1&amp;query=Bozeman%20Yellowstone%20International%20Airport" target="_blank" rel="noreferrer"><i data-lucide="map-pin"></i>View airport</a></div>
          </div>
          <div class="route-stop">
            <div class="route-time">Late Night</div><div class="route-icon"><i data-lucide="bed-double"></i></div>
            <div class="route-copy"><strong>Airport hotel</strong><p>Use the hotel shuttle. Collect the rental car the following morning.</p><a class="map-link" href="https://www.google.com/maps/search/?api=1&amp;query=Hotels%20near%20Bozeman%20Yellowstone%20International%20Airport" target="_blank" rel="noreferrer"><i data-lucide="map-pin"></i>Nearby hotels</a></div>
          </div>
        </div>"""
content = content.replace(route_original, route_new)
content = content.replace('<p class="section-note">Wednesday evening</p>', '<p class="section-note">Arrival Day</p>')

# 4. Day Tabs
tabs_original = """<button class="day-tab" role="tab" aria-selected="true" data-day="0"><span class="weekday">Wed</span><span class="date">19</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="1"><span class="weekday">Thu</span><span class="date">20</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="2"><span class="weekday">Fri</span><span class="date">21</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="3"><span class="weekday">Sat</span><span class="date">22</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="4"><span class="weekday">Sun</span><span class="date">23</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="5"><span class="weekday">Mon</span><span class="date">24</span></button>"""
tabs_new = """<button class="day-tab" role="tab" aria-selected="true" data-day="0"><span class="weekday">Day</span><span class="date">1</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="1"><span class="weekday">Day</span><span class="date">2</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="2"><span class="weekday">Day</span><span class="date">3</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="3"><span class="weekday">Day</span><span class="date">4</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="4"><span class="weekday">Day</span><span class="date">5</span></button>
          <button class="day-tab" role="tab" aria-selected="false" data-day="5"><span class="weekday">Day</span><span class="date">6</span></button>"""
content = content.replace(tabs_original, tabs_new)

# 5. Bookings List
content = content.replace('<strong>Alaska flights</strong><p>Aug 19 outbound · Aug 24 return</p></div><span class="badge confirmed">Confirmed</span>', '<strong>Flights</strong><p>Outbound & Return</p></div><span class="badge todo">To book</span>')
content = content.replace('<strong>Grant Village</strong><p>Aug 20–23 · inside Yellowstone</p></div><span class="badge confirmed">Confirmed</span>', '<strong>Park Lodging</strong><p>e.g. Grant Village (3 nights)</p></div><span class="badge todo">To book</span>')
content = content.replace('<span class="badge confirmed">Confirmed</span>', '<span class="badge todo">To book</span>')

# 6. JS Data
js_original = """const days = [
      { eyebrow: "Travel night", title: "Redmond → SEA → Bozeman", note: "Workday preserved; no midnight rental driving.", items: [
        ["3:15 PM", "Leave Sixty-01", "Metro 245 or short rideshare to Redmond Technology.", "Redmond Technology Station", "transit"],
        ["4:07 PM", "ST 560 from Bellevue", "Target bus; 4:37 PM is the backup.", "Seattle-Tacoma International Airport", "transit"],
        ["5:10 PM", "Arrive SEA", "Security, dinner and gate by 7:25 PM.", "Seattle-Tacoma International Airport", "transit"],
        ["8:16 PM", "Alaska 1323", "Nonstop to BZN, arriving 10:59 PM.", "Bozeman Yellowstone International Airport", "driving"],
        ["11:30 PM", "Airport hotel", "Call shuttle after collecting bags.", "Hotels near Bozeman Yellowstone International Airport", "driving"]
      ]},
      { eyebrow: "Park arrival", title: "Bozeman → Grant Village", note: "Rental pickup and an easy first evening.", items: [
        ["7:00 AM", "Breakfast and checkout", "Check NPS roads and download offline maps.", null, null],
        ["8:05 AM", "Pick up rental", "Photograph the car and verify fuel policy.", "Bozeman Yellowstone International Airport Rental Car Return", "driving"],
        ["10:35 AM", "West Yellowstone stop", "Fuel, picnic supplies, restrooms and bear spray.", "West Yellowstone Montana", "driving"],
        ["11:05 AM", "Enter Yellowstone", "West Entrance toward Madison and West Thumb.", "Yellowstone National Park West Entrance", "driving"],
        ["2:15 PM", "West Thumb", "Lake-edge geyser basin boardwalk, about one hour.", "West Thumb Geyser Basin", "driving"],
        ["3:45 PM", "Grant Village", "Check in, early dinner and quiet lake evening.", "Grant Village Yellowstone National Park", "driving"]
      ]},
      { eyebrow: "Geothermal day", title: "Old Faithful + Grand Prismatic", note: "The classic lower-loop highlights.", items: [
        ["6:20 AM", "Leave Grant", "Breakfast packed; beat tour-bus traffic.", "Old Faithful Yellowstone National Park", "driving"],
        ["7:15 AM", "Old Faithful", "Check eruption prediction at the visitor center.", "Old Faithful Visitor Education Center", "walking"],
        ["9:00 AM", "Upper Geyser Basin", "Comfortable boardwalk section toward Castle and Grand.", "Upper Geyser Basin Yellowstone", "walking"],
        ["11:30 AM", "Picnic lunch", "Eat before moving north.", null, null],
        ["12:20 PM", "Grand Prismatic overlook", "About 1.6 miles round trip from Fairy Falls trailhead.", "Grand Prismatic Spring Overlook Trailhead", "driving"],
        ["3:30 PM", "Fountain Paint Pot", "Optional short boardwalk before returning to Grant.", "Fountain Paint Pot Trail Yellowstone", "driving"]
      ]},
      { eyebrow: "Wildlife + canyon", title: "Hayden Valley and Lower Falls", note: "Early start; longest park-driving day.", items: [
        ["5:55 AM", "Leave Grant", "Warm layers, lunch and binoculars ready.", "Hayden Valley Yellowstone National Park", "driving"],
        ["7:10 AM", "Hayden Valley", "Use pullouts and scan quietly for wildlife.", "Hayden Valley Yellowstone National Park", "driving"],
        ["8:45 AM", "Mud Volcano", "Short boardwalk if everyone is comfortable.", "Mud Volcano Yellowstone National Park", "driving"],
        ["10:00 AM", "Artist Point", "Classic Grand Canyon and Lower Falls view.", "Artist Point Yellowstone National Park", "driving"],
        ["11:45 AM", "Canyon lunch", "Restrooms, water and Junior Ranger break.", "Canyon Village Yellowstone National Park", "driving"],
        ["1:00 PM", "North Rim", "Choose one or two overlooks based on energy.", "Brink of Lower Falls Trail Yellowstone", "driving"],
        ["3:45 PM", "Return via Hayden", "A second wildlife window on the way back.", "Grant Village Yellowstone National Park", "driving"]
      ]},
      { eyebrow: "Return day", title: "Grant Village → BZN", note: "One flexible stop, then protect the flight buffer.", items: [
        ["6:30 AM", "Breakfast and checkout", "Load the car and inspect the room.", null, null],
        ["7:20 AM", "One final park stop", "West Thumb, Yellowstone Lake or a missed Friday stop.", "West Thumb Geyser Basin", "driving"],
        ["12:00 PM", "West Yellowstone lunch", "Review rental return instructions.", "West Yellowstone Montana", "driving"],
        ["2:00 PM", "Hard departure", "Drive north; do not add another long stop.", "Bozeman Yellowstone International Airport", "driving"],
        ["5:15 PM", "Return rental", "Photograph fuel gauge and exterior.", "Bozeman Yellowstone International Airport Rental Car Return", "driving"],
        ["6:30 PM", "Airport hotel", "Confirm the early shuttle and sleep.", "Hotels near Bozeman Yellowstone International Airport", "driving"]
      ]},
      { eyebrow: "Home morning", title: "Bozeman → SEA → Redmond", note: "Early flight leaves part of Monday available.", items: [
        ["4:15 AM", "Wake and checkout", "Check flight status and collect medicines.", null, null],
        ["4:45 AM", "Hotel shuttle", "Confirm exact pickup Sunday evening.", "Bozeman Yellowstone International Airport", "driving"],
        ["5:00 AM", "BZN security", "Breakfast and gate by 6:20 AM.", "Bozeman Yellowstone International Airport", "walking"],
        ["7:03 AM", "Alaska 761", "Nonstop to SEA, arriving 8:08 AM.", "Seattle-Tacoma International Airport", "driving"],
        ["8:45 AM", "Choose home route", "Rideshare for speed; rail and bus for lowest cost.", "Redmond Technology Station", "transit"],
        ["10:30 AM", "Home target", "Transit may arrive closer to 11:00 AM.", null, null]
      ]}
    ];"""
js_new = """const days = [
      { eyebrow: "Travel night", title: "Home → Bozeman (BZN)", note: "Take an afternoon/evening flight. Get some rest.", items: [
        ["Afternoon", "Leave Home", "Head to your local airport.", null, null],
        ["Evening", "Flight to BZN", "Fly into Bozeman Yellowstone International.", "Bozeman Yellowstone International Airport", "driving"],
        ["Late Night", "Airport hotel", "Call shuttle after collecting bags.", "Hotels near Bozeman Yellowstone International Airport", "driving"]
      ]},
      { eyebrow: "Park arrival", title: "Bozeman → Yellowstone", note: "Rental pickup and an easy first evening.", items: [
        ["7:00 AM", "Breakfast and checkout", "Check NPS roads and download offline maps.", null, null],
        ["8:05 AM", "Pick up rental", "Photograph the car and verify fuel policy.", "Bozeman Yellowstone International Airport Rental Car Return", "driving"],
        ["10:35 AM", "West Yellowstone stop", "Fuel, picnic supplies, restrooms and bear spray.", "West Yellowstone Montana", "driving"],
        ["11:05 AM", "Enter Yellowstone", "West Entrance toward Madison and West Thumb.", "Yellowstone National Park West Entrance", "driving"],
        ["2:15 PM", "West Thumb", "Lake-edge geyser basin boardwalk, about one hour.", "West Thumb Geyser Basin", "driving"],
        ["3:45 PM", "Check in to Lodging", "Early dinner and quiet evening.", "Grant Village Yellowstone National Park", "driving"]
      ]},
      { eyebrow: "Geothermal day", title: "Old Faithful + Grand Prismatic", note: "The classic lower-loop highlights.", items: [
        ["6:20 AM", "Leave early", "Breakfast packed; beat tour-bus traffic.", "Old Faithful Yellowstone National Park", "driving"],
        ["7:15 AM", "Old Faithful", "Check eruption prediction at the visitor center.", "Old Faithful Visitor Education Center", "walking"],
        ["9:00 AM", "Upper Geyser Basin", "Comfortable boardwalk section toward Castle and Grand.", "Upper Geyser Basin Yellowstone", "walking"],
        ["11:30 AM", "Picnic lunch", "Eat before moving north.", null, null],
        ["12:20 PM", "Grand Prismatic overlook", "About 1.6 miles round trip from Fairy Falls trailhead.", "Grand Prismatic Spring Overlook Trailhead", "driving"],
        ["3:30 PM", "Fountain Paint Pot", "Optional short boardwalk before returning.", "Fountain Paint Pot Trail Yellowstone", "driving"]
      ]},
      { eyebrow: "Wildlife + canyon", title: "Hayden Valley and Lower Falls", note: "Early start; longest park-driving day.", items: [
        ["5:55 AM", "Leave early", "Warm layers, lunch and binoculars ready.", "Hayden Valley Yellowstone National Park", "driving"],
        ["7:10 AM", "Hayden Valley", "Use pullouts and scan quietly for wildlife.", "Hayden Valley Yellowstone National Park", "driving"],
        ["8:45 AM", "Mud Volcano", "Short boardwalk if everyone is comfortable.", "Mud Volcano Yellowstone National Park", "driving"],
        ["10:00 AM", "Artist Point", "Classic Grand Canyon and Lower Falls view.", "Artist Point Yellowstone National Park", "driving"],
        ["11:45 AM", "Canyon lunch", "Restrooms, water and Junior Ranger break.", "Canyon Village Yellowstone National Park", "driving"],
        ["1:00 PM", "North Rim", "Choose one or two overlooks based on energy.", "Brink of Lower Falls Trail Yellowstone", "driving"],
        ["3:45 PM", "Return via Hayden", "A second wildlife window on the way back.", "Hayden Valley Yellowstone National Park", "driving"]
      ]},
      { eyebrow: "Return day", title: "Yellowstone → BZN", note: "One flexible stop, then protect the flight buffer.", items: [
        ["6:30 AM", "Breakfast and checkout", "Load the car and inspect the room.", null, null],
        ["7:20 AM", "One final park stop", "West Thumb, Yellowstone Lake or a missed Friday stop.", "West Thumb Geyser Basin", "driving"],
        ["12:00 PM", "West Yellowstone lunch", "Review rental return instructions.", "West Yellowstone Montana", "driving"],
        ["2:00 PM", "Hard departure", "Drive north; do not add another long stop.", "Bozeman Yellowstone International Airport", "driving"],
        ["5:15 PM", "Return rental", "Photograph fuel gauge and exterior.", "Bozeman Yellowstone International Airport Rental Car Return", "driving"],
        ["6:30 PM", "Airport hotel", "Confirm the early shuttle and sleep.", "Hotels near Bozeman Yellowstone International Airport", "driving"]
      ]},
      { eyebrow: "Home morning", title: "BZN → Home", note: "Early flight leaves part of the day available.", items: [
        ["4:15 AM", "Wake and checkout", "Check flight status and collect medicines.", null, null],
        ["4:45 AM", "Hotel shuttle", "Confirm exact pickup Sunday evening.", "Bozeman Yellowstone International Airport", "driving"],
        ["5:00 AM", "BZN security", "Breakfast and gate.", "Bozeman Yellowstone International Airport", "walking"],
        ["7:03 AM", "Flight home", "Depart BZN.", null, "driving"],
        ["Morning", "Transit", "Head home from your local airport.", null, "transit"]
      ]}
    ];"""
content = content.replace(js_original, js_new)

# 7. Footer
content = content.replace("Private family plan · Updated July 17, 2026", "Trip Planner Template · Flexible guide")

with open(file_path, "w") as f:
    f.write(content)

print("Update completed.")
