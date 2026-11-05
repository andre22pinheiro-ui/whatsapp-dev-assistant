Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Surface_Dpc\Desktop\projectos\whatsapp-dev-assistant"
WshShell.Run "node src/index.js", 0, False

