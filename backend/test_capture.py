from scapy.all import sniff

print("Capture de 10 paquets... fais un ping ou ouvre un site.")
sniff(count=10, prn=lambda p: print(p.summary()))
print("OK, la capture fonctionne !")
