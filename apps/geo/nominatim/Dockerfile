# Nominatim — geocoding (endereço -> coordenadas) sobre OpenStreetMap.
# No 1º boot importa o PBF (PBF_URL, definido nas variáveis da Railway) para o
# Postgres embutido. Monte um Volume da Railway em /var/lib/postgresql/14/main
# para persistir o banco importado (a versão 4.4 usa PostgreSQL 14).
FROM mediagis/nominatim:4.4

# IMPORT_STYLE=address  -> import leve, só o necessário p/ geocoding de endereços
# REVERSE_ONLY=false    -> precisamos de forward (endereço -> lat/lng)
# FREEZE=true           -> descarta tabelas de import após a carga (economiza disco)
# PBF_URL e NOMINATIM_PASSWORD são definidos nas variáveis da Railway.
ENV IMPORT_STYLE=address \
    REVERSE_ONLY=false \
    FREEZE=true

# API HTTP do Nominatim
EXPOSE 8080
