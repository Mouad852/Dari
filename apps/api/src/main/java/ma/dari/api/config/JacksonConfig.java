package ma.dari.api.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.cfg.DateTimeFeature;

@Configuration
public class JacksonConfig {

    @Bean
    JsonMapperBuilderCustomizer jacksonCustomizer() {
        return builder -> builder
                // ISO-8601 UTC strings, not epoch millis. Morocco moves its
                // clocks around Ramadan; every instant crossing the wire stays
                // unambiguous.
                .disable(DateTimeFeature.WRITE_DATES_AS_TIMESTAMPS)
                // An unknown field in a request body is a client bug worth
                // surfacing, not something to swallow silently.
                .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);
    }
}
