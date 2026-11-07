Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Users\Surface_Dpc\Desktop\projectos\whatsapp-dev-assistant"
WshShell.Run "powershell -WindowStyle Hidden -ExecutionPolicy Bypass -Command ""while ($true) { node scripts/pc-worker.js >> data/worker.log 2>&1; Start-Sleep -Seconds 3 }""", 0, False

