#!/usr/bin/env ruby
#

require 'json'

ME=File.basename($0, ".rb")
MD=File.dirname($0)

desc=File.join(MD, "description.txt")
puts "desc=#{desc}"

begin
	puts "Reading from #{desc}"

	metadata_file=File.join(MD, "..", "eclipse@blackjackshellac.ca", "metadata.json")
	puts "Updating #{metadata_file}"

	metadata_json=File.read(metadata_file)
	metadata=JSON.parse(metadata_json)
	metadata["description"]=File.read(desc)

	metadata_json=JSON.pretty_generate(metadata)
	puts metadata_json

	File.open(metadata_file, "w") { |fd|
	  puts "Writing #{metadata_file}"
	  fd.puts metadata_json
	}

	puts "--- Final description ---"
	puts metadata_json
rescue => e
	puts "ERROR: "+e.to_s
	exit 1
end

