package ma.dari.api.config;

import ma.dari.api.common.auth.FirebaseAuthFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

/**
 * Stateless bearer-token security.
 *
 * <p>There is no session, no CSRF token and no login form, because Dari does not
 * authenticate anyone: the client signs in against Firebase and sends the
 * resulting ID token. Adding a {@code /auth/login} endpoint later would be a
 * design regression, not a feature.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private final FirebaseAuthFilter firebaseAuthFilter;

    public SecurityConfig(FirebaseAuthFilter firebaseAuthFilter) {
        this.firebaseAuthFilter = firebaseAuthFilter;
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())          // no cookies, no CSRF surface
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()

                        // Public read surface: search and listing detail must be
                        // crawlable and usable before signup. Everything these
                        // return is already fuzzed and filtered at the DTO layer.
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/listings/**",
                                "/api/v1/cities/**",
                                "/api/v1/amenities/**",
                                "/api/v1/users/*").permitAll()

                        // First-launch profile creation: a verified Firebase
                        // identity with no Dari row yet must be able to call it.
                        .requestMatchers(HttpMethod.POST, "/api/v1/users").authenticated()

                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .addFilterBefore(firebaseAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(
            @Value("${dari.web-origins}") List<String> origins) {

        var config = new CorsConfiguration();
        config.setAllowedOrigins(origins);              // explicit list, never "*"
        config.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        config.setMaxAge(3600L);

        var source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
