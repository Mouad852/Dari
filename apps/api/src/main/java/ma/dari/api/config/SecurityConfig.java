package ma.dari.api.config;

import ma.dari.api.common.auth.FirebaseAuthFilter;
import ma.dari.api.common.auth.RestAccessDeniedHandler;
import ma.dari.api.common.auth.RestAuthenticationEntryPoint;
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
import org.springframework.security.web.header.writers.ReferrerPolicyHeaderWriter;
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
    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    public SecurityConfig(FirebaseAuthFilter firebaseAuthFilter,
                          RestAuthenticationEntryPoint authenticationEntryPoint,
                          RestAccessDeniedHandler accessDeniedHandler) {
        this.firebaseAuthFilter = firebaseAuthFilter;
        this.authenticationEntryPoint = authenticationEntryPoint;
        this.accessDeniedHandler = accessDeniedHandler;
    }

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        return http
                .csrf(csrf -> csrf.disable())          // no cookies, no CSRF surface
                .cors(Customizer.withDefaults())
                .headers(headers -> headers
                        .contentTypeOptions(Customizer.withDefaults())
                        .frameOptions(frame -> frame.deny())
                        .referrerPolicy(referrer -> referrer
                                .policy(ReferrerPolicyHeaderWriter.ReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN))
                        .httpStrictTransportSecurity(hsts -> hsts
                                .includeSubDomains(true)
                                .maxAgeInSeconds(31536000))
                        .permissionsPolicy(permissions -> permissions
                                .policy("camera=(), microphone=(), geolocation=()")))
                // Chain-level rejections must carry the same envelope as every
                // other error. The defaults are a bodyless 403 for both cases.
                .exceptionHandling(handling -> handling
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/actuator/health", "/actuator/info").permitAll()

                        // Stored listing photos and avatars, served by
                        // WebMvcConfig's resource handler. These are <img src>
                        // targets: a browser sends no Authorization header for
                        // them, so requiring one means every photo on every
                        // public listing page fails to load. The files are
                        // already public content -- they are what search results
                        // and listing pages exist to show -- and the storage key
                        // is an unguessable UUID path.
                        .requestMatchers(HttpMethod.GET, "/uploads/**").permitAll()

                        // Owner-scoped reads that live UNDER the public prefixes
                        // below. Matchers are evaluated in order, so these must
                        // come first: the wildcard permitAll that follows would
                        // otherwise swallow them and leave routes returning one
                        // owner's own drafts defended by a single layer — the
                        // @CurrentUser resolver — instead of the two this project
                        // requires everywhere else. Nothing leaked while that was
                        // true, because the resolver does throw, but a future GET
                        // added under /listings/** that reads a path variable
                        // rather than the current user would have been public with
                        // nothing to catch it.
                        .requestMatchers(HttpMethod.GET,
                                "/api/v1/listings/mine",
                                "/api/v1/listings/mine/**",
                                "/api/v1/listings/draft",
                                "/api/v1/listings/*/photos",
                                "/api/v1/users/me").authenticated()

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
