import React from 'react';
import Head from 'next/head';
import BottomNavigationNew from '@/components/BottomNavigation-new';
import { MapPin, Navigation, Clock, Phone, ExternalLink } from 'lucide-react';
import styles from '@/styles/ComoChegar.module.css';

const ComoChegarPage: React.FC = () => {
  const mapUrl = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3947.100980046969!2d-40.52049108870534!3d-9.38717672223402!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x773708890b91c4b%3A0x6ef8a8cf12899c35!2sR.%20Remanso%20-%20Jardim%20Maravilha%2C%20Petrolina%20-%20PE%2C%2056306-670!5e0!3m2!1spt-BR!2sbr!4v1700000000000!5m2!1spt-BR!2sbr";
  
  const googleMapsLink = "https://www.google.com/maps/place/R.+Remanso+-+Jardim+Maravilha,+Petrolina+-+PE,+56306-670/@-9.3870987,-40.520491,17z/data=!3m1!4b1!4m6!3m5!1s0x773708890b91c4b:0x6ef8a8cf12899c35!8m2!3d-9.3871767!4d-40.5179604!16s%2Fg%2F1vmr1l3y";
  
  const wazeLink = "https://waze.com/ul?q=R.%20Remanso%20-%20Jardim%20Maravilha,%20Petrolina%20-%20PE";

  return (
    <>
      <Head>
        <title>Como Chegar - Maria Doce</title>
        <meta name="description" content="Veja como chegar à Maria Doce Gelateria em Petrolina - PE" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main>
        <div className={styles.container}>
          <div className={styles.heroSection}>
            <h1 className={styles.title}>📍 Como Chegar</h1>
            <p className={styles.subtitle}>
              Encontre-nos facilmente e venha saborear nossos deliciosos gelatos!
            </p>
          </div>

          <div className={styles.mapSection}>
            <div className={styles.mapContainer}>
              <iframe
                src={mapUrl}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen={true}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Localização da Maria Doce Gelateria">
              </iframe>
            </div>
          </div>

          <div className={styles.infoSection}>
            <div className={styles.addressCard}>
              <div className={styles.addressText}>
                <MapPin size={24} />
                R. Remanso - Jardim Maravilha, Petrolina - PE, 56306-670
              </div>
              <p className={styles.instructionText}>
                Clique nos botões abaixo para traçar sua rota!
              </p>
            </div>

            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <Navigation className={styles.featureIcon} size={32} />
                <h3 className={styles.featureTitle}>Fácil Acesso</h3>
                <p className={styles.featureDescription}>
                  Localização estratégica no Jardim Maravilha, fácil de encontrar
                </p>
              </div>
              
              <div className={styles.featureCard}>
                <Clock className={styles.featureIcon} size={32} />
                <h3 className={styles.featureTitle}>Horário de Funcionamento</h3>
                <p className={styles.featureDescription}>
                  Seg-Dom: 14h às 22h<br />
                  Sempre aberto para adoçar seu dia!
                </p>
              </div>
              
              <div className={styles.featureCard}>
                <Phone className={styles.featureIcon} size={32} />
                <h3 className={styles.featureTitle}>Contato</h3>
                <p className={styles.featureDescription}>
                  Ligue para nós:<br />
                  (87) 9 9999-9999
                </p>
              </div>
            </div>

            <div className={styles.actionButtons}>
              <a 
                href={googleMapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.actionButton}
              >
                <ExternalLink size={18} />
                Abrir no Google Maps
              </a>
              
              <a 
                href={wazeLink}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.actionButton}
              >
                <Navigation size={18} />
                Navegar com Waze
              </a>
            </div>
          </div>
        </div>
      </main>

      <BottomNavigationNew />
    </>
  );
};

export default ComoChegarPage;

