package ma.dari.api.config;

import ma.dari.api.common.auth.CurrentUserArgumentResolver;
import ma.dari.api.common.ratelimit.RateLimitInterceptor;
import ma.dari.api.media.MediaAccessInterceptor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.nio.file.Path;
import java.util.List;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final CurrentUserArgumentResolver currentUserArgumentResolver;
    private final RateLimitInterceptor rateLimitInterceptor;
    private final MediaAccessInterceptor mediaAccessInterceptor;
    private final String uploadDir;

    public WebMvcConfig(CurrentUserArgumentResolver currentUserArgumentResolver,
                        RateLimitInterceptor rateLimitInterceptor,
                        MediaAccessInterceptor mediaAccessInterceptor,
                        @Value("${dari.upload-dir:./uploads}") String uploadDir) {
        this.currentUserArgumentResolver = currentUserArgumentResolver;
        this.rateLimitInterceptor = rateLimitInterceptor;
        this.mediaAccessInterceptor = mediaAccessInterceptor;
        this.uploadDir = uploadDir;
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(currentUserArgumentResolver);
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(rateLimitInterceptor);
        registry.addInterceptor(mediaAccessInterceptor).addPathPatterns("/uploads/**");
    }

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        Path root = Path.of(uploadDir).toAbsolutePath().normalize();
        registry.addResourceHandler("/uploads/**")
                .addResourceLocations(root.toUri().toString());
    }
}
