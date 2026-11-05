Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Surface_Dpc\Desktop\projectos\whatsapp-dev-assistant"
WshShell.Run "node scripts/pc-worker.js", 0, False

