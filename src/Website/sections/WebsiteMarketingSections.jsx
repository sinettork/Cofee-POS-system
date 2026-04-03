import { DAY_SCHEDULE, EXPERIENCE_ITEMS, TESTIMONIALS } from '../constants/websiteContent'

export function WebsiteMarketingSections({ todayName }) {
  return (
    <>
      <section className="eloise-experience" id="experience">
        <div className="eloise-section-header eloise-reveal">
          <div className="eloise-section-label eloise-center-label">Why Eloise</div>
          <h2>The Eloise Experience</h2>
        </div>
        <div className="eloise-exp-grid">
          {EXPERIENCE_ITEMS.map((item) => (
            <div className="eloise-exp-card eloise-reveal" key={item.title}>
              <div className="eloise-exp-icon">{item.icon}</div>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="eloise-testimonials">
        <div className="eloise-section-header eloise-reveal">
          <div className="eloise-section-label eloise-center-label">What Guests Say</div>
          <h2>Loved by Coffee Lovers</h2>
        </div>
        <div className="eloise-test-grid">
          {TESTIMONIALS.map((item) => (
            <div className="eloise-test-card eloise-reveal" key={item.name}>
              <div className="eloise-stars">{'\u2605\u2605\u2605\u2605\u2605'}</div>
              <blockquote>{item.quote}</blockquote>
              <div className="eloise-test-author">
                <div className="eloise-test-avatar">{item.avatar}</div>
                <div>
                  <div className="eloise-test-name">{item.name}</div>
                  <div className="eloise-test-role">{item.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="eloise-info-section" id="location">
        <div className="eloise-info-map">{'\u{1F5FA}\uFE0F'}</div>
        <div className="eloise-info-details eloise-reveal">
          <div className="eloise-section-label">Find Us</div>
          <h2>Visit Eloise Coffee</h2>
          <div className="eloise-hours-grid">
            {Object.keys(DAY_SCHEDULE).map((day) => (
              <div className={`eloise-hour-row ${day === todayName ? 'today' : ''}`} key={day}>
                <span className="day">
                  {day}
                  {day === todayName ? ' (Today)' : ''}
                </span>
                <span className="time">{DAY_SCHEDULE[day]}</span>
              </div>
            ))}
          </div>
          <div className="eloise-address">
            <span>{'\u{1F4CD}'}</span>
            <p>
              123 Coffee Lane, Table 01 District
              <br />
              Your City, CC 00100
              <br />
              <br />
              <strong>+1 (012) 345-6789</strong>
              <br />
              hello@eloisecoffee.com
            </p>
          </div>
        </div>
      </section>

      <section className="eloise-newsletter">
        <div className="eloise-section-label eloise-center-label">Stay in the Loop</div>
        <h2>
          Get Weekly Specials and
          <br />
          New Menu Drops
        </h2>
        <p>No spam, just the good stuff. Seasonal menus, events, and exclusive subscriber offers.</p>
        <div className="eloise-newsletter-form">
          <input type="email" placeholder="your@email.com" />
          <button>Subscribe</button>
        </div>
      </section>

      <footer className="eloise-footer">
        <div className="eloise-footer-top">
          <div className="eloise-footer-brand">
            <a href="#top" className="eloise-nav-logo">
              <span>Eloise</span> Coffee
            </a>
            <p>Crafting moments of warmth, one cup at a time. Specialty coffee and fresh pastries served with heart.</p>
            <div className="eloise-footer-social">
              <a className="eloise-social-btn" href="#top">{'\u{1F4D8}'}</a>
              <a className="eloise-social-btn" href="#top">{'\u{1F4F8}'}</a>
              <a className="eloise-social-btn" href="#top">{'\u{1F426}'}</a>
              <a className="eloise-social-btn" href="#top">{'\u25B6\uFE0F'}</a>
            </div>
          </div>
          <div className="eloise-footer-col">
            <h4>Menu</h4>
            <ul>
              <li><a href="#menu">Coffee</a></li>
              <li><a href="#menu">Pastries</a></li>
              <li><a href="#menu">Cakes</a></li>
              <li><a href="#menu">Breads</a></li>
              <li><a href="#menu">Sandwiches</a></li>
              <li><a href="#menu">Donuts</a></li>
            </ul>
          </div>
          <div className="eloise-footer-col">
            <h4>Visit</h4>
            <ul>
              <li><a href="#location">Location</a></li>
              <li><a href="#location">Hours</a></li>
              <li><a href="#menu">Reservations</a></li>
              <li><a href="#menu">Private Events</a></li>
              <li><a href="#menu">Catering</a></li>
            </ul>
          </div>
          <div className="eloise-footer-col">
            <h4>Company</h4>
            <ul>
              <li><a href="#about">Our Story</a></li>
              <li><a href="#experience">Sustainability</a></li>
              <li><a href="#experience">Careers</a></li>
              <li><a href="#experience">Press</a></li>
              <li><a href="#location">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="eloise-footer-bottom">
          <span>{'\u00A9 2026 Eloise Coffee. All rights reserved.'}</span>
          <span>{'Privacy \u00B7 Terms \u00B7 Cookies'}</span>
        </div>
      </footer>
    </>
  )
}
