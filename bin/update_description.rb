#!/usr/bin/env ruby
#

require 'json'

ME=File.basename($0, ".rb")
MD=File.dirname($0)

desc=File.join(MD, "description.txt")
puts "desc=#{desc}"

begin
	puts "Reading from #{desc}"
	description=File.read(desc)

	metadata_file=File.join(MD, "..", "eclipse@blackjackshellac.ca", "metadata.json")
	puts "Updating #{metadata_file}"

	metadata_json=File.read(metadata_file)
	metadata=JSON.parse(metadata_json)
	puts "metadata[description]=#{metadata["description"]}"

	description.gsub!(/\n/, '\n')

	metadata["description"]=description

	puts JSON.pretty_generate(metadata)

	File.open(metadata_file, "w") { |fd|
	  puts "Writing #{metadata_file}"
	  fd.puts JSON.pretty_generate(metadata)
	}
rescue => e
	puts "ERROR: "+e.to_s
	exit 1
end

