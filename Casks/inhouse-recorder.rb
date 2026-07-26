cask "inhouse-recorder" do
  version "1.0.0"
  sha256 "11bc5a01c62cdde1a1c15f79a3728978e3b165ba7daef81df5d52b327c8aa50f"

  url "https://github.com/mianik/Inhouse-Recorder/releases/download/v#{version}/InhouseRecorder-#{version}-arm64.dmg"
  name "Inhouse Recorder"
  desc "A collaborative local-first screen recorder"
  homepage "https://github.com/mianik/Inhouse-Recorder"

  app "InhouseRecorder.app"

  zap trash: [
    "~/Library/Application Support/InhouseRecorder",
    "~/Library/Preferences/com.antigravity.inhouserecorder.plist",
    "~/Library/Saved Application State/com.antigravity.inhouserecorder.savedState"
  ]
end
