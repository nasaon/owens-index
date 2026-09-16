' 작업 스케줄러가 매일 07:00에 창 없이 실행 (노트북이 꺼져 있었으면 켜진 뒤 실행). 기록은 daily.log
CreateObject("WScript.Shell").Run "cmd /c cd /d D:\JJH\RO && node daily.mjs >> daily.log 2>&1", 0, True
