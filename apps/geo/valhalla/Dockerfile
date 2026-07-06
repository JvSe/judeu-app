# Valhalla — motor de rotas/ETA sobre OpenStreetMap (self-hosted na Railway)
# A imagem já traz o entrypoint que, no boot, baixa o PBF (tile_urls) e constrói
# os tiles em /custom_files. Monte um Volume da Railway em /custom_files para
# persistir os tiles entre deploys (senão reconstrói toda vez).
FROM ghcr.io/nilsnolde/docker-valhalla/valhalla:latest

# Config padrão (o PBF em si — tile_urls — é definido nas variáveis da Railway).
ENV serve_tiles=True \
    use_tiles_ignore_pbf=True \
    build_elevation=False \
    build_admins=True \
    build_time_zones=False \
    force_rebuild=False

# Porta do valhalla_service
EXPOSE 8002
