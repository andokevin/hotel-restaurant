-- Exécuté UNE SEULE FOIS, au tout premier démarrage (volume pg_data vide).
-- Si le volume existe déjà, créer une nouvelle base à la main :
--   docker compose exec postgres psql -U hotel -d postgres -c "CREATE DATABASE nom_db"

-- Une base par service
CREATE DATABASE hebergement_db;
CREATE DATABASE facturation_db;
CREATE DATABASE auth_db;

-- Bases de test (vidées par les tests, jamais utilisées en dev)
CREATE DATABASE hebergement_test_db;
CREATE DATABASE facturation_test_db;
CREATE DATABASE auth_test_db;
